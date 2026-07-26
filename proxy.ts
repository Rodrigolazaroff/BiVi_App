import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * En Next 16 este archivo reemplaza al viejo `middleware.ts`.
 *
 * Hace dos cosas en cada request:
 *   1. Refresca el token de Supabase y reescribe las cookies.
 *   2. Decide el acceso ANTES de renderizar, para que nadie vea el dashboard
 *      parpadear antes de ser redirigido al login.
 */

/** Rutas accesibles sin sesion iniciada. */
const PUBLIC_PATHS = ['/login', '/auth'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() revalida contra Supabase. No usar getSession() para autorizar:
  // esa lee la cookie sin verificarla.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Con sesion abierta, el login no tiene nada que ofrecer.
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todo salvo estaticos y la API.
     *
     * offline.html queda afuera a proposito: es el respaldo que guarda el
     * service worker, y si lo interceptaramos terminaria cacheando un redirect
     * al login en lugar de la pantalla de "sin conexion".
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw\\.js|offline\\.html|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)',
  ],
};
