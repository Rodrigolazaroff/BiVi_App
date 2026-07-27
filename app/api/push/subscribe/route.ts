import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Alta y baja de la suscripcion push del dispositivo actual.
 *
 * Requiere sesion: la suscripcion se asocia al elder del cuidador autenticado,
 * y RLS garantiza que nadie pueda anotar dispositivos en cuentas ajenas.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Tu sesión expiró. Volvé a ingresar.' }, { status: 401 });
  }

  const { data: elder } = await supabase.from('elders').select('id').maybeSingle();
  if (!elder) {
    return NextResponse.json(
      { error: 'Primero cargá los datos del adulto mayor.' },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const endpoint: string | undefined = body?.endpoint;
  const p256dh: string | undefined = body?.keys?.p256dh;
  const auth: string | undefined = body?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'La suscripción llegó incompleta.' }, { status: 400 });
  }

  // El endpoint es unico: si el navegador renovo la suscripcion, se pisa la vieja.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ elder_id: elder.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' });

  if (error) {
    return NextResponse.json({ error: 'No pudimos guardar la suscripción.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Tu sesión expiró.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint: string | undefined = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: 'Falta el endpoint a dar de baja.' }, { status: 400 });
  }

  // RLS limita el borrado a las suscripciones del propio elder.
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

  return NextResponse.json({ ok: true });
}
