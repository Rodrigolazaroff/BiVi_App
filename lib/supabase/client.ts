import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para componentes que corren en el navegador.
 * La sesion vive en cookies, no en localStorage, para que el middleware
 * y los Server Components puedan leerla.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
