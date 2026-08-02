import { createClient } from '@/lib/supabase/server';
import InstallButton from '@/components/InstallButton';
import CerrarSesion from './client';

export default async function CuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: elder } = await supabase.from('elders').select('full_name').maybeSingle();

  const meta = user?.user_metadata ?? {};
  const nombre = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || meta.full_name;

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-bivi-text">
          Cuenta
        </h1>
        <p className="mt-1 text-bivi-muted">Tu sesión y la app en el celular</p>
      </header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-bivi-text">Tus datos</h2>
          <dl className="mt-4 space-y-3">
            {nombre && (
              <div>
                <dt className="text-sm font-bold text-bivi-muted">Nombre</dt>
                <dd className="text-bivi-text">{nombre}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-bold text-bivi-muted">Email</dt>
              <dd className="break-all text-bivi-text">{user?.email}</dd>
            </div>
          </dl>
        </section>

        <InstallButton elderName={(elder?.full_name as string) ?? ''} />

        <CerrarSesion />
      </div>
    </>
  );
}
