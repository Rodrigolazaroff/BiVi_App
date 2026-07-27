import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { enviarAviso, type SuscripcionGuardada } from '@/lib/push';
import { tomasPendientes, type Medicamento, type TomaPendiente } from '@/lib/medicamentos';

/**
 * Recordatorios a horario. Lo invoca pg_cron (desde Supabase) cada 10 minutos.
 *
 * Corre sin sesion de usuario, asi que usa la secret key del proyecto: es el
 * unico lugar de la app donde se saltea RLS, y por eso el endpoint exige el
 * CRON_SECRET antes de hacer nada.
 */

/** Solo se avisan tomas cuya hora paso hace menos de esto. */
const VENTANA_MINUTOS = 30;

interface FilaMedicamento extends Medicamento {
  elder_id: string;
  elders: { full_name: string } | null;
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: 'Falta SUPABASE_SECRET_KEY' }, { status: 500 });
  }

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY
  );

  const ahora = new Date();
  const desdeVentana = new Date(ahora.getTime() - VENTANA_MINUTOS * 60_000).toISOString();

  const { data: medicamentos } = await supabase
    .from('medications')
    .select('id, elder_id, nombre, dosis, horarios, activo, desde, hasta, elders (full_name)')
    .eq('activo', true)
    .returns<FilaMedicamento[]>();

  if (!medicamentos || medicamentos.length === 0) {
    return NextResponse.json({ avisados: 0 });
  }

  const [{ data: tomas }, { data: avisados }] = await Promise.all([
    supabase
      .from('medication_intakes')
      .select('medication_id, previsto_para')
      .gte('previsto_para', desdeVentana),
    supabase
      .from('push_avisos')
      .select('medication_id, previsto_para')
      .gte('previsto_para', desdeVentana),
  ]);

  // Las tomas ya confirmadas y las ya avisadas se descartan igual: en ambos
  // casos no corresponde molestar de nuevo.
  const excluidas = [...(tomas ?? []), ...(avisados ?? [])];

  // tolerancia 0: el aviso sale apenas pasa la hora, a diferencia de la charla,
  // que espera un rato para no sonar a alarma.
  const pendientes = tomasPendientes(medicamentos, excluidas, ahora, 0).filter(
    // Lo viejo del dia no se re-avisa: si el permiso se activo a la tarde, no
    // tiene sentido notificar la toma de la maniana.
    (p) => p.previstoPara.getTime() >= ahora.getTime() - VENTANA_MINUTOS * 60_000
  );

  let enviados = 0;

  for (const toma of pendientes) {
    const med = medicamentos.find((m) => m.id === toma.medicationId);
    if (!med) continue;

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('elder_id', med.elder_id)
      .returns<SuscripcionGuardada[]>();

    if (!subs || subs.length === 0) continue;

    const nombrePila = (med.elders?.full_name ?? '').split(' ')[0];
    const resultado = await avisarToma(supabase, subs, nombrePila, toma);
    if (resultado) enviados++;
  }

  return NextResponse.json({ avisados: enviados });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function avisarToma(
  supabase: any,
  subs: SuscripcionGuardada[],
  nombrePila: string,
  toma: TomaPendiente
): Promise<boolean> {
  // Se registra ANTES de enviar: si esto corriera dos veces en paralelo, el
  // UNIQUE hace que una de las dos pierda y nadie reciba el aviso duplicado.
  const { error } = await supabase
    .from('push_avisos')
    .insert({ medication_id: toma.medicationId, previsto_para: toma.previstoPara.toISOString() });
  if (error) return false;

  const saludo = nombrePila ? `${nombrePila}, es` : 'Es';
  const dosis = toma.dosis ? ` (${toma.dosis})` : '';

  let alguno = false;
  for (const sub of subs) {
    const resultado = await enviarAviso(sub, {
      titulo: 'BiVi te recuerda',
      cuerpo: `${saludo} la hora del ${toma.nombre}${dosis} · ${toma.hora}`,
      url: '/talk',
    });

    if (resultado === 'ok') alguno = true;
    if (resultado === 'baja') {
      // El navegador ya la dio de baja: se limpia para no reintentar siempre.
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
  }

  return alguno;
}
