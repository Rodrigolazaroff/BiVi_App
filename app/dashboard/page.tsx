import { createClient } from '@/lib/supabase/server';
import ResumenUso from '@/components/ResumenUso';
import Medicamentos from '@/components/Medicamentos';
import Notificaciones from '@/components/Notificaciones';
import { resumirUso, type SesionResumen } from '@/lib/uso';
import { momentoLocal, type Medicamento } from '@/lib/medicamentos';
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

  // El resumen se arma en el servidor: son datos de solo lectura y asi ya
  // llegan renderizados, sin un salto de carga en el panel.
  const { data: elder } = await supabase.from('elders').select('id, full_name').maybeSingle();

  const { data: sesiones } = await supabase
    .from('sessions')
    .select('started_at, duration_seconds, status')
    .order('started_at', { ascending: false })
    .limit(30);

  const { data: medicamentos } = await supabase
    .from('medications')
    .select('id, nombre, dosis, horarios, activo, desde, hasta')
    .eq('activo', true)
    .order('created_at');

  /*
   * Leer el reloj es impuro, y por eso el linter lo marca. Aca es intencional:
   * este componente ya es asincronico e impuro (consulta la base), se ejecuta
   * una sola vez en el servidor y no se hidrata, asi que no hay riesgo de que
   * cliente y servidor muestren horas distintas. Sellar el momento aca y
   * pasarlo hacia abajo mantiene puros a los componentes que lo reciben.
   */
  // eslint-disable-next-line react-hooks/purity
  const ahora = Date.now();
  const resumen = resumirUso((sesiones ?? []) as SesionResumen[], ahora);
  // El servidor de Vercel corre en UTC: "hoy" se calcula en hora de Argentina.
  const { fecha: hoy } = momentoLocal(new Date(ahora));

  return (
    <main className="min-h-screen bg-gradient-to-b from-bivi-blue-soft via-bivi-bg to-bivi-green-soft/40 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-bivi-text">
            {firstName ? `Hola, ${firstName}` : 'Tu panel'}
          </h1>
          <p className="mt-1 text-bivi-muted">Panel de administración de BiVi</p>
        </header>

        <div className="space-y-6">
          {elder && (
            <ResumenUso
              resumen={resumen}
              nombre={elder.full_name as string}
              ahora={ahora}
            />
          )}
          <DashboardClient />
          {elder && (
            <Medicamentos
              elderId={elder.id as string}
              iniciales={(medicamentos ?? []) as Medicamento[]}
              hoy={hoy}
            />
          )}
          {elder && <Notificaciones />}
        </div>
      </div>
    </main>
  );
}
