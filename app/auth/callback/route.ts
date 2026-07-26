import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Vuelta de Supabase despues de un login con Google o de un mail de
 * recuperacion. Cambia el `code` de un solo uso por una sesion en cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  // `next` solo puede ser una ruta interna: si viniera con un dominio ajeno
  // seria un redirect abierto.
  const target = next.startsWith('/') ? next : '/dashboard';
  return NextResponse.redirect(`${origin}${target}`);
}
