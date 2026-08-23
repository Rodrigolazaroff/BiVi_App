import {
  formatearDuracion,
  haceCuanto,
  partirDuracion,
  type ResumenDeUso,
  type SesionResumen,
} from '@/lib/uso';

/**
 * Muestra el uso de BiVi al cuidador. Solo presentacion: el calculo vive en
 * lib/uso.ts y `ahora` llega desde afuera para no leer el reloj al renderizar.
 *
 * Las cifras son el acumulado de siempre, no de la semana: lo que le importa
 * al cuidador es si la persona esta usando BiVi, no un corte de siete dias.
 * El detalle dia por dia lo cuenta el grafico, y cada charla suelta vive en el
 * desplegable del final.
 */

/** Alto de la barra mas alta del grafico, en px. */
const ALTO_BARRA = 72;

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

  if (!resumen.hayDatos) {
    return (
      <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-bivi-text">Conversaciones</h2>
        <p className="mt-1 mb-5 text-bivi-muted">
          Se registra cuándo y cuánto conversaron. Lo que hablan es privado y no se guarda.
        </p>
        <p className="rounded-xl bg-bivi-bg px-4 py-6 text-center text-bivi-muted">
          Todavía no hay conversaciones registradas.
          <br />
          Van a aparecer acá cuando {primerNombre} charle con BiVi.
        </p>
      </section>
    );
  }

  // La barra mas alta manda la escala. Si todos los dias tienen una sola
  // charla, igual se ven llenas: la comparacion es entre dias, no absoluta.
  const pico = Math.max(...resumen.porDia.map((d) => d.charlas), 1);
  const charlasEnLaSemana = resumen.porDia.reduce((acc, d) => acc + d.charlas, 0);

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">Conversaciones</h2>
      <p className="mt-1 mb-6 text-bivi-muted">
        Se registra cuándo y cuánto conversaron. Lo que hablan es privado y no se guarda.
      </p>

      {/* Dos cifras nada mas, y las dos cortas. Antes eran tres tarjetas de
          ancho fijo y "hace 42 minutos" desbordaba la suya. */}
      <div className="grid grid-cols-2 gap-4">
        <Cifra
          valor={String(resumen.charlas)}
          unidad={resumen.charlas === 1 ? 'charla' : 'charlas'}
          etiqueta="en total"
        />
        <Cifra {...partirDuracion(resumen.segundosTotales)} etiqueta="conversando" />
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-bold text-bivi-text">Últimos 7 días</h3>
          <p className="text-sm text-bivi-muted">
            {charlasEnLaSemana === 1 ? '1 charla' : `${charlasEnLaSemana} charlas`}
          </p>
        </div>

        <ul
          className="flex items-end justify-between gap-1.5"
          style={{ height: ALTO_BARRA + 28 }}
        >
          {resumen.porDia.map((dia) => {
            const alto = dia.charlas === 0 ? 4 : Math.round((dia.charlas / pico) * ALTO_BARRA);
            return (
              <li key={dia.fecha} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-bold tabular-nums text-bivi-blue">
                  {dia.charlas > 0 ? dia.charlas : ''}
                </span>
                <span
                  className={`w-full rounded-md ${
                    dia.charlas > 0 ? 'bg-bivi-blue' : 'bg-bivi-border/70'
                  }`}
                  style={{ height: alto }}
                />
                <span className="text-xs text-bivi-muted">
                  {dia.inicial}
                  <span className="sr-only">
                    {` ${dia.nombre}: ${dia.charlas === 1 ? '1 charla' : `${dia.charlas} charlas`}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {resumen.ultima && (
        <p className="mt-6 rounded-xl bg-bivi-blue-soft/60 px-4 py-3 text-sm text-bivi-text">
          <span className="font-bold">Última charla</span> {haceCuanto(resumen.ultima.started_at, ahora)}
          {resumen.ultima.duration_seconds
            ? `, de ${formatearDuracion(resumen.ultima.duration_seconds)}`
            : ''}
          . Duración promedio: {formatearDuracion(resumen.promedioSegundos)}.
        </p>
      )}

      <details className="group mt-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-bivi-muted transition-colors hover:text-bivi-text [&::-webkit-details-marker]:hidden">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-200 ease-out group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          Ver todas las charlas ({resumen.charlas})
        </summary>

        <ul className="mt-3 max-h-80 divide-y divide-bivi-border/60 overflow-y-auto overscroll-contain border-y border-bivi-border/60">
          {resumen.todas.map((s) => (
            <Charla key={s.started_at} sesion={s} />
          ))}
        </ul>
      </details>
    </section>
  );
}

function Cifra({
  valor,
  unidad,
  etiqueta,
}: {
  valor: string;
  unidad: string;
  etiqueta: string;
}) {
  return (
    <div className="rounded-xl bg-bivi-blue-soft/60 px-4 py-4">
      <p className="font-display text-3xl font-semibold tracking-tight text-bivi-blue">
        <span className="tabular-nums">{valor}</span>{' '}
        <span className="text-lg">{unidad}</span>
      </p>
      <p className="mt-0.5 text-sm leading-tight text-bivi-muted">{etiqueta}</p>
    </div>
  );
}

function Charla({ sesion }: { sesion: SesionResumen }) {
  const cuando = new Date(sesion.started_at);

  return (
    <li className="flex items-baseline justify-between gap-4 py-3">
      <span className="text-bivi-text">
        {cuando.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}
      </span>
      <span className="shrink-0 text-sm tabular-nums text-bivi-muted">
        {cuando.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        {sesion.duration_seconds ? ` · ${formatearDuracion(sesion.duration_seconds)}` : ''}
      </span>
    </li>
  );
}
