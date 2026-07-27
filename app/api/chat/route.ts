import {
  GoogleGenerativeAI,
  SchemaType,
  type Content,
  type FunctionCall,
  type Tool,
} from '@google/generative-ai';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt } from '@/lib/systemPrompt';
import {
  describirPendientes,
  tomasPendientes,
  type Medicamento,
  type TomaPendiente,
} from '@/lib/medicamentos';

/** El historial se recorta: sin limite crece hasta encarecer y frenar cada respuesta. */
const MAX_TURNOS = 20;

interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * La herramienta que el modelo puede invocar solo.
 *
 * Es lo que permite entender un "ya la tomé", un "sí, recién" o un "ya está"
 * sin depender de buscar frases exactas en el texto: decide el modelo, que es
 * quien entiende el contexto de la charla.
 *
 * Solo puede REGISTRAR una toma. No puede crear, modificar ni borrar
 * medicamentos: eso es siempre del cuidador.
 */
const HERRAMIENTAS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'registrar_toma',
        description:
          'Registra que la persona confirmó haber tomado un medicamento. Usar solo ante una confirmación clara.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            medicamento: {
              type: SchemaType.STRING,
              description: 'Nombre exacto del medicamento, tal como figura en la lista de pendientes.',
            },
          },
          required: ['medicamento'],
        },
      },
    ],
  },
];

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Falta configurar la clave de Gemini en el servidor.' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // El endpoint estaba abierto: cualquiera podia consumir la cuota de Gemini.
    if (!user) {
      return NextResponse.json({ error: 'Tu sesión expiró. Volvé a ingresar.' }, { status: 401 });
    }

    const { userMessage, history } = (await request.json()) as {
      userMessage?: string;
      history?: Mensaje[];
    };

    if (!userMessage?.trim()) {
      return NextResponse.json({ error: 'No llegó ningún mensaje.' }, { status: 400 });
    }

    // La ficha se lee del servidor. Antes el prompt venia del navegador, lo que
    // permitia mandar cualquier instruccion y ya habia causado un prompt vacio.
    const { data: elder } = await supabase
      .from('elders')
      .select('id, full_name, age, favorite_topics')
      .maybeSingle();

    if (!elder) {
      return NextResponse.json(
        { error: 'Todavía no cargaste los datos del adulto mayor.' },
        { status: 400 }
      );
    }

    const pendientes = await buscarPendientes(supabase, elder.id);

    const systemInstruction = buildSystemPrompt(
      elder.full_name,
      elder.age,
      elder.favorite_topics ?? [],
      describirPendientes(pendientes)
    );

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      // Sin pendientes no se ofrece la herramienta: no hay nada que registrar.
      ...(pendientes.length > 0 ? { tools: HERRAMIENTAS } : {}),
    });

    const previos = (history ?? []).slice(-MAX_TURNOS);
    const contents: Content[] = [
      ...previos.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: userMessage }] },
    ];

    let respuesta = await model.generateContent({ contents });
    const llamadas = respuesta.response.functionCalls();

    let registradas: string[] = [];

    if (llamadas && llamadas.length > 0) {
      registradas = await ejecutarLlamadas(supabase, llamadas, pendientes);

      // Se le devuelve el resultado al modelo para que cierre con una frase
      // natural, en vez de que el servidor invente el texto por el.
      contents.push(
        { role: 'model', parts: llamadas.map((call) => ({ functionCall: call })) },
        {
          role: 'function',
          parts: llamadas.map((call) => ({
            functionResponse: {
              name: call.name,
              response: { registrado: registradas.length > 0 },
            },
          })),
        }
      );

      respuesta = await model.generateContent({ contents });
    }

    const reply = respuesta.response.text();

    return NextResponse.json({
      reply,
      registradas,
      history: [
        ...(history ?? []),
        { role: 'user', content: userMessage },
        { role: 'assistant', content: reply },
      ],
    });
  } catch (error) {
    console.error('Chat error:', error);

    /*
     * El plan gratuito de Gemini permite 5 pedidos por minuto. Una charla
     * fluida los consume rapido, sobre todo porque una toma confirmada gasta
     * dos (el pedido y la vuelta con el resultado de la herramienta). Se
     * distingue del resto de los errores para no decirle a la persona que algo
     * se rompio cuando en realidad solo hay que esperar unos segundos.
     */
    const mensaje = error instanceof Error ? error.message : '';
    if (mensaje.includes('429') || mensaje.toLowerCase().includes('quota')) {
      return NextResponse.json(
        { error: 'Estamos yendo muy rápido. Esperá unos segundos y seguimos charlando.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'BiVi no pudo responder. Probá de nuevo en un momento.' },
      { status: 500 }
    );
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Medicamentos que ya deberian haberse tomado hoy y siguen sin confirmar. */
async function buscarPendientes(supabase: any, elderId: string): Promise<TomaPendiente[]> {
  const { data: medicamentos } = await supabase
    .from('medications')
    .select('id, nombre, dosis, horarios, activo')
    .eq('elder_id', elderId)
    .eq('activo', true);

  if (!medicamentos || medicamentos.length === 0) return [];

  const desdeMedianoche = new Date();
  desdeMedianoche.setHours(0, 0, 0, 0);

  const { data: tomas } = await supabase
    .from('medication_intakes')
    .select('medication_id, previsto_para')
    .gte('previsto_para', desdeMedianoche.toISOString());

  return tomasPendientes(medicamentos as Medicamento[], tomas ?? [], new Date());
}

/**
 * Ejecuta lo que pidio el modelo. Solo registra tomas que estuvieran realmente
 * pendientes: si el modelo nombra un medicamento que no corresponde, se ignora.
 */
async function ejecutarLlamadas(
  supabase: any,
  llamadas: FunctionCall[],
  pendientes: TomaPendiente[]
): Promise<string[]> {
  const registradas: string[] = [];

  for (const llamada of llamadas) {
    if (llamada.name !== 'registrar_toma') continue;

    const pedido = String((llamada.args as any)?.medicamento ?? '').trim().toLowerCase();
    if (!pedido) continue;

    const toma =
      pendientes.find((p) => p.nombre.toLowerCase() === pedido) ??
      pendientes.find((p) => p.nombre.toLowerCase().includes(pedido)) ??
      pendientes.find((p) => pedido.includes(p.nombre.toLowerCase()));

    if (!toma) continue;

    // El UNIQUE de la tabla evita duplicar la misma toma si se confirma dos veces.
    const { error } = await supabase.from('medication_intakes').upsert(
      {
        medication_id: toma.medicationId,
        previsto_para: toma.previstoPara.toISOString(),
        origen: 'voz',
      },
      { onConflict: 'medication_id,previsto_para' }
    );

    if (!error) registradas.push(toma.nombre);
  }

  return registradas;
}
