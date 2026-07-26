import { createClient } from '@/lib/supabase/server';
import DashboardClient from './client';

/**
 * El control de acceso ya lo hizo proxy.ts, asi que aca no hace falta el
 * chequeo de sesion en el cliente ni la pantalla intermedia de "Cargando...".
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.user_metadata ?? {};
  const firstName: string =
    meta.first_name || String(meta.full_name ?? meta.name ?? '').split(' ')[0] || '';

  return (
    <main className="min-h-screen bg-gradient-to-b from-bivi-blue-soft via-bivi-bg to-bivi-green-soft/40 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-bivi-text">
            {firstName ? `Hola, ${firstName}` : 'Tu panel'}
          </h1>
          <p className="mt-1 text-bivi-muted">Panel de administración de BiVi</p>
        </header>

        <DashboardClient />
      </div>
    </main>
  );
}
