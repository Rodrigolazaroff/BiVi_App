import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { DatosExtraidos } from '@/lib/documentos';

/**
 * Extrae de un documento recien subido lo que la historia clinica necesita.
 *
 * Corre UNA vez por archivo y guarda el resultado en la fila: reprocesar el
 * PDF en cada consulta seria lento y quemaria la cuota de Gemini (5 req/min
 * en el plan gratuito). El archivo se descarga con la sesion del cuidador,
 * asi las policies de Storage siguen mandando.
 */

const INSTRUCCION = `Sos un asistente que organiza documentación médica para un cuidador familiar.
Del documento adjunto extraé, en español:

- tipo_documento: qué es (análisis de laboratorio, informe médico, receta, estudio de imagen, epicrisis, otro).
- fecha_documento: la fecha del documento en formato YYYY-MM-DD, o null si no figura.
- titulo: un título corto y descriptivo (ej: "Análisis de sangre — Hospital Italiano").
- resumen: 3 a 6 líneas con lo que el documento dice, en lenguaje claro.
- valores_relevantes: lista corta de datos concretos que figuran (ej: "Glucemia 110 mg/dl", "Presión 130/80").

Reglas estrictas:
- Solo transcribí y resumí lo que el documento DICE. No diagnostiques, no interpretes
  resultados como buenos o malos, no recomiendes tratamientos ni cambios de medicación.
- Si el documento no es legible o no parece documentación médica, decilo en el resumen.

Respondé únicamente con JSON válido: {"tipo_documento": ..., "fecha_documento": ..., "titulo": ..., "resumen": ..., "valores_relevantes": [...]}`;

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const documentId: string | undefined = body?.documentId;
  if (!documentId) {
    return NextResponse.json({ error: 'Falta el documento a procesar.' }, { status: 400 });
  }

  // RLS acota la busqueda a los documentos del propio elder.
  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path, mime_type, resumen')
    .eq('id', documentId)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: 'No encontramos ese documento.' }, { status: 404 });
  }
  if (doc.resumen) {
    // Ya procesado: no gastar otra pasada de Gemini.
    return NextResponse.json({ ok: true, yaProcesado: true });
  }

  const { data: archivo, error: bajada } = await supabase.storage
    .from('documentos')
    .download(doc.storage_path);

  if (bajada || !archivo) {
    return NextResponse.json({ error: 'No pudimos leer el archivo subido.' }, { status: 500 });
  }

  const base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64');

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const respuesta = await model.generateContent([
      { inlineData: { mimeType: doc.mime_type, data: base64 } },
      { text: INSTRUCCION },
    ]);

    const crudo = JSON.parse(respuesta.response.text()) as DatosExtraidos & { resumen: string };

    const datos: DatosExtraidos = {
      tipo_documento: String(crudo.tipo_documento ?? 'otro'),
      fecha_documento: crudo.fecha_documento ? String(crudo.fecha_documento) : null,
      titulo: String(crudo.titulo ?? ''),
      valores_relevantes: Array.isArray(crudo.valores_relevantes)
        ? crudo.valores_relevantes.map(String)
        : [],
    };

    const { error: guardado } = await supabase
      .from('documents')
      .update({
        resumen: String(crudo.resumen ?? ''),
        datos,
        procesado_en: new Date().toISOString(),
      })
      .eq('id', doc.id);

    if (guardado) {
      return NextResponse.json({ error: 'No pudimos guardar la extracción.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, datos });
  } catch (error) {
    console.error('Error procesando documento:', error);

    const mensaje = error instanceof Error ? error.message : '';
    if (mensaje.includes('429') || mensaje.toLowerCase().includes('quota')) {
      return NextResponse.json(
        { error: 'Se procesaron muchos archivos seguidos. Esperá un minuto y reintentá.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'No pudimos leer el documento. Probá con otro archivo.' },
      { status: 500 }
    );
  }
}
