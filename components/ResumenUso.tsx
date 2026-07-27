import { formatearDuracion, haceCuanto, type ResumenDeUso } from '@/lib/uso';

/**
 * Muestra el uso de BiVi al cuidador. Solo presentacion: el calculo vive en
 * lib/uso.ts y `ahora` llega desde afuera para no leer el reloj al renderizar.
 */
export default function ResumenUso({
  resumen,
  nombre,
  ahora,
}: {
  resumen: ResumenDeUso;
  nombre: string;
  ahora: number;
}) {
  const primerNombre = nombre.split(' ')[0] || nombre;

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">Cómo viene la semana</h2>
      <p className="mt-1 mb-6 text-bivi-muted">
        Se registra cuándo y cuánto conversaron. Lo que hablan es privado y no se guarda.
      </p>

      {!resumen.hayDatos ? (
        <p className="rounded-xl bg-bivi-bg px-4 py-6 text-center text-bivi-muted">
          Todavía no hay conversaciones registradas.
          <br />
          Van a aparecer acá cuando {primerNombre} charle con BiVi.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Dato valor={String(resumen.charlasEstaSemana)} etiqueta="charlas esta semana" />
            <Dato
              valor={resumen.promedioSegundos > 0 ? formatearDuracion(resumen.promedioSegundos) : '—'}
              etiqueta="duración promedio"
            />
            <Dato
              valor={resumen.ultimaEn ? haceCuanto(resumen.ultimaEn, ahora) : '—'}
              etiqueta="última vez"
            />
          </div>

          <ul className="mt-6 divide-y divide-bivi-border/60">
            {resumen.recientes.map((s) => (
              <li key={s.started_at} className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-bivi-text">
                  {new Date(s.started_at).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="shrink-0 text-sm text-bivi-muted">
                  {new Date(s.started_at).toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {s.duration_seconds ? ` · ${formatearDuracion(s.duration_seconds)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="rounded-xl bg-bivi-blue-soft/60 px-3 py-4 text-center">
      <p className="font-display text-xl font-semibold text-bivi-blue">{valor}</p>
      <p className="mt-1 text-xs leading-tight text-bivi-muted">{etiqueta}</p>
    </div>
  );
}
