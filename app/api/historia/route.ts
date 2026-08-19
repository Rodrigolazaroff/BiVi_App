import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { describirPeriodo, formatearHora, momentoLocal, type Medicamento } from '@/lib/medicamentos';
import type { Documento } from '@/lib/documentos';
import type {
  EstudioItem,
  Historia,
  MedicacionItem,
  SeccionesRedactadas,
} from '@/lib/historia';

/**
 * Compila todo lo cargado (ficha, medicacion con periodos, extracciones de los
 * documentos) y arma la historia clinica con la estructura que usa un medico:
 * antecedentes patologicos, medicacion habitual, enfermedad actual e impresion
 * diagnostica.
 *
 * NO lleva "plan": indicar conducta es un acto medico y BiVi no lo es. Por el
 * mismo motivo la impresion diagnostica no se elabora: solo se transcriben los
 * diagnosticos que YA figuran escritos en la documentacion, con su fuente.
 *
 * Medicacion y estudios no los redacta el modelo: salen tal cual de la base.
 */

const INSTRUCCION = `Sos un asistente que ordena documentación médica para que un cuidador familiar la lleve a la consulta.
Con los datos que te paso, redactá en español tres secciones.

1. antecedentes_patologicos: lista de enfermedades, cirugías, alergias, internaciones o
   tratamientos previos que YA figuren mencionados en la documentación o en el historial de
   medicación. Una línea por antecedente, corta. Si un antecedente sale de un tratamiento
   finalizado, aclarálo (ej: "Tratamiento con enalapril, finalizado en 03/2025").

2. enfermedad_actual: 1 a 3 párrafos con el motivo y la situación actual según los documentos
   más recientes: qué se está estudiando o controlando, desde cuándo, y qué muestran los
   últimos estudios. Contá lo que dicen los documentos, sin evaluarlo.

3. impresion_diagnostica: SOLO los diagnósticos que aparecen escritos textualmente en la
   documentación, uno por línea, cada uno con la fuente entre paréntesis
   (ej: "Hipertensión arterial (informe cardiológico del 12/03/2025)").
   NO elabores ni deduzcas diagnósticos propios. Si en la documentación no figura ningún
   diagnóstico, devolvé la lista vacía.

Reglas estrictas:
- Usá únicamente la información provista. No inventes ni completes huecos.
- No diagnostiques, no interpretes valores como buenos o malos, no sugieras tratamientos,
  estudios ni cambios de medicación. No incluyas ninguna conducta ni plan.
- Lenguaje claro, sin jerga innecesaria. Sin viñetas ni Markdown en el texto.
- Si una sección no tiene respaldo en los datos, devolvé la lista vacía.

Respondé únicamente con JSON válido:
{"antecedentes_patologicos": [...], "enfermedad_actual": [...], "impresion_diagnostica": [...]}`;

/** Normaliza a lista de strings limpios lo que haya devuelto el modelo. */
function lista(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((x) => String(x).trim()).filter(Boolean);
}

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

  // --- Medicacion: se arma en el servidor, no la redacta el modelo ---------
  const medicacion: MedicacionItem[] = [];
  const medicacionPrevia: MedicacionItem[] = [];

  ((medicamentos ?? []) as Medicamento[]).forEach((m) => {
    const partes = [
      m.dosis || null,
      `toma a las ${m.horarios.map(formatearHora).join(', ')}`,
      m.activo ? describirPeriodo(m, hoy) : 'tratamiento dado de baja',
    ].filter(Boolean) as string[];

    const item: MedicacionItem = { nombre: m.nombre, detalle: partes.join(' · ') };
    (m.activo ? medicacion : medicacionPrevia).push(item);
  });

  // --- Estudios: idem, salen de la extraccion ya guardada ------------------
  const estudios: EstudioItem[] = ((documentos ?? []) as Documento[]).map((d) => ({
    fecha: d.datos?.fecha_documento ?? null,
    titulo: d.datos?.titulo || d.nombre,
    tipo: d.datos?.tipo_documento ?? 'documento',
    resumen: d.resumen ?? '',
    valores: d.datos?.valores_relevantes ?? [],
  }));

  const contexto = `FECHA DE HOY: ${hoy}

PERSONA:
- Nombre: ${elder.full_name}
- Edad: ${elder.age} años

MEDICACIÓN EN CURSO:
${medicacion.map((m) => `- ${m.nombre} · ${m.detalle}`).join('\n') || '(sin medicación cargada)'}

TRATAMIENTOS FINALIZADOS O DADOS DE BAJA:
${medicacionPrevia.map((m) => `- ${m.nombre} · ${m.detalle}`).join('\n') || '(ninguno)'}

DOCUMENTOS SUBIDOS (resúmenes ya extraídos, del más reciente al más viejo):
${
  estudios
    .map(
      (e) =>
        `- ${e.titulo} (${e.tipo}, fecha: ${e.fecha ?? 'sin fecha'})\n  ${e.resumen}${
          e.valores.length ? `\n  Valores que figuran: ${e.valores.join('; ')}` : ''
        }`
    )
    .join('\n') || '(sin documentos)'
}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: INSTRUCCION,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const respuesta = await model.generateContent(contexto);
    const crudo = JSON.parse(respuesta.response.text()) as Partial<SeccionesRedactadas>;

    const historia: Historia = {
      paciente: { nombre: elder.full_name as string, edad: elder.age as number },
      generadaEl: hoy,
      antecedentes: lista(crudo.antecedentes_patologicos),
      medicacion,
      medicacionPrevia,
      enfermedadActual: lista(crudo.enfermedad_actual),
      impresionDiagnostica: lista(crudo.impresion_diagnostica),
      estudios,
    };

    return NextResponse.json({ historia });
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
