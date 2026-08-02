import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { describirPeriodo, formatearHora, momentoLocal, type Medicamento } from '@/lib/medicamentos';
import type { Documento } from '@/lib/documentos';

/**
 * Compila todo lo cargado (ficha, medicacion con periodos, extracciones de los
 * documentos) y redacta la historia clinica.
 *
 * Es un RESUMEN PARA LLEVAR AL MEDICO, no un acto medico: el prompt prohibe
 * diagnosticar, interpretar resultados u opinar de tratamientos, el mismo
 * limite que ya rige en la conversacion y en la lectura de documentos.
 */

const INSTRUCCION = `Sos un asistente que ordena información para un cuidador familiar de un adulto mayor.
Con los datos que te paso, redactá en español una "Historia clínica resumida" en Markdown, con estas secciones (omití las que no tengan datos):

## Datos de la persona
## Medicación actual
## Tratamientos finalizados
## Estudios y documentos
(ordenados del más reciente al más viejo, cada uno con fecha, qué es y qué dice)
## Datos concretos que figuran en la documentación
(lista de valores puntuales con su fecha)

Reglas estrictas:
- Usá únicamente la información provista. No inventes, no completes huecos.
- No diagnostiques, no interpretes valores como buenos o malos, no sugieras
  tratamientos ni cambios de medicación. Solo ordená lo que está documentado.
- Lenguaje claro, sin jerga innecesaria.
- No agregues título general ni leyendas finales: eso lo pone la aplicación.`;

export async function POST() {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Falta configurar la clave de Gemini.' }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Tu sesión expiró. Volvé a ingresar.' }, { status: 401 });
  }

  const { data: elder } = await supabase
    .from('elders')
    .select('id, full_name, age')
    .maybeSingle();
  if (!elder) {
    return NextResponse.json({ error: 'Primero cargá la ficha del adulto mayor.' }, { status: 400 });
  }

  const [{ data: medicamentos }, { data: documentos }] = await Promise.all([
    // Todos, tambien los inactivos: el historial de tratamientos es parte
    // de la historia clinica.
    supabase
      .from('medications')
      .select('nombre, dosis, horarios, activo, desde, hasta')
      .order('created_at'),
    supabase
      .from('documents')
      .select('nombre, resumen, datos, created_at')
      .not('resumen', 'is', null)
      .order('created_at', { ascending: false }),
  ]);

  const { fecha: hoy } = momentoLocal(new Date());

  const lineasMedicacion = ((medicamentos ?? []) as Medicamento[]).map((m) => {
    const horarios = m.horarios.map(formatearHora).join(', ');
    const estado = m.activo ? describirPeriodo(m, hoy) : 'dado de baja';
    return `- ${m.nombre}${m.dosis ? ` (${m.dosis})` : ''} · horarios: ${horarios} · ${estado}`;
  });

  const bloquesDocumentos = ((documentos ?? []) as Documento[]).map((d) => {
    const datos = d.datos;
    const valores = datos?.valores_relevantes?.length
      ? `\n  Valores que figuran: ${datos.valores_relevantes.join('; ')}`
      : '';
    return `- ${datos?.titulo || d.nombre} (${datos?.tipo_documento ?? 'documento'}, fecha: ${
      datos?.fecha_documento ?? 'sin fecha'
    })\n  ${d.resumen}${valores}`;
  });

  const contexto = `FECHA DE HOY: ${hoy}

PERSONA:
- Nombre: ${elder.full_name}
- Edad: ${elder.age} años

MEDICACIÓN REGISTRADA:
${lineasMedicacion.join('\n') || '(sin medicación cargada)'}

DOCUMENTOS SUBIDOS (resúmenes ya extraídos):
${bloquesDocumentos.join('\n') || '(sin documentos)'}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: INSTRUCCION,
    });

    const respuesta = await model.generateContent(contexto);
    const historia = respuesta.response.text();

    return NextResponse.json({ historia, generadaEl: hoy });
  } catch (error) {
    console.error('Error generando historia:', error);

    const mensaje = error instanceof Error ? error.message : '';
    if (mensaje.includes('429') || mensaje.toLowerCase().includes('quota')) {
      return NextResponse.json(
        { error: 'Muchas consultas seguidas. Esperá un minuto y volvé a intentar.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'No pudimos generar la historia clínica. Probá de nuevo.' },
      { status: 500 }
    );
  }
}
