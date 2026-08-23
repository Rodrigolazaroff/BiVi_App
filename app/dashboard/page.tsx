import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ResumenUso from '@/components/ResumenUso';
import { resumirUso, type SesionResumen } from '@/lib/uso';

/**
 * Inicio: el pulso de la semana y el boton de conversar.
 * La ficha, los remedios y la cuenta viven en sus propias pestanias.
 */
export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.user_metadata ?? {};
  const firstName: string =
    meta.first_name || String(meta.full_name ?? meta.name ?? '').split(' ')[0] || '';

  const { data: elder } = await supabase.from('elders').select('id, full_name').maybeSingle();

  const { data: sesiones } = elder
    ? await supabase
        .from('sessions')
        .select('started_at, duration_seconds, status')
        .order('started_at', { ascending: false })
        .limit(30)
    : { data: null };

  // Sellar el reloj aca mantiene puros a los componentes que lo reciben.
  // eslint-disable-next-line react-hooks/purity
  const ahora = Date.now();
  const resumen = resumirUso((sesiones ?? []) as SesionResumen[], ahora);

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-bivi-text">
          {firstName ? `Hola, ${firstName}` : 'Tu panel'}
        </h1>
        <p className="mt-1 text-bivi-muted">Panel de administración de BiVi</p>
      </header>

      <div className="space-y-6">
        {elder ? (
          <>
            <Link
              href="/talk"
              className="block w-full rounded-2xl bg-bivi-green px-4 py-5 text-center font-display text-2xl font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-bivi-green-dark active:scale-[0.99]"
            >
              ¿Conversamos?
            </Link>

            <ResumenUso resumen={resumen} nombre={elder.full_name as string} ahora={ahora} />
          </>
        ) : (
          <section className="rounded-2xl border border-bivi-border/70 bg-white p-8 text-center shadow-card">
            <h2 className="font-display text-2xl font-semibold text-bivi-text">
              Empecemos por la ficha
            </h2>
            <p className="mx-auto mt-2 mb-6 max-w-sm text-bivi-muted">
              Contanos quién va a conversar con BiVi: con su nombre, edad y temas favoritos
              ya puede arrancar la primera charla.
            </p>
            <Link
              href="/dashboard/ficha"
              className="inline-block rounded-xl bg-bivi-blue px-6 py-3.5 font-bold text-white transition hover:bg-bivi-blue-dark active:scale-[0.99]"
            >
              Completar la ficha
            </Link>
          </section>
        )}
      </div>
    </>
  );
}
