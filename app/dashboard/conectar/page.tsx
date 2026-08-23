import type { ReactNode } from 'react';

/**
 * Conectar: los aparatos de la casa que se suman a BiVi.
 */
interface Dispositivo {
  nombre: string;
  paraQue: string;
  ejemplos: string;
  icono: ReactNode;
}

const DISPOSITIVOS: Dispositivo[] = [
  {
    nombre: 'Cámaras del hogar',
    paraQue: 'Ver cómo está la casa desde el celular, sin tener que llamar para saber.',
    ejemplos: 'Ezviz, Tapo, Ring',
    icono: (
      <>
        <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H8l1.5-2h5L16 6h2.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
        <circle cx="12" cy="12.5" r="3.5" />
      </>
    ),
  },
  {
    nombre: 'Relojes y pulseras',
    paraQue: 'Pasos, sueño y pulsaciones del día, sin que tenga que anotar nada.',
    ejemplos: 'Apple Watch, Fitbit, Galaxy Watch',
    icono: (
      <>
        <rect x="7" y="6" width="10" height="12" rx="3" />
        <path d="M9.5 6V3h5v3M9.5 18v3h5v-3M12 10v2.6l1.6 1" />
      </>
    ),
  },
  {
    nombre: 'Anteojos inteligentes',
    paraQue: 'Conversar con BiVi sin tener el celular en la mano.',
    ejemplos: 'Ray-Ban Meta',
    icono: (
      <>
        <circle cx="6.5" cy="14" r="3.5" />
        <circle cx="17.5" cy="14" r="3.5" />
        <path d="M10 14c0-1 .9-1.7 2-1.7s2 .7 2 1.7M3 12.5 4.5 8.5H7M21 12.5 19.5 8.5H17" />
      </>
    ),
  },
  {
    nombre: 'Parlantes inteligentes',
    paraQue: 'Que los recordatorios suenen en voz alta en la casa, no solo en el celular.',
    ejemplos: 'Alexa, Google Nest',
    icono: (
      <>
        <rect x="6" y="3" width="12" height="18" rx="3" />
        <circle cx="12" cy="14.5" r="3" />
        <path d="M12 7h.01" />
      </>
    ),
  },
];

export default function ConectarPage() {
  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-bivi-text">
          Conectar
        </h1>
        <p className="mt-1 text-bivi-muted">Los aparatos de la casa, sumados a BiVi</p>
      </header>

      <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
        {/* En mobile el boton baja a su propia linea: compartiendo fila con
            el texto, la descripcion quedaba en una columna de 117px. */}
        <ul className="divide-y divide-bivi-border/60">
          {DISPOSITIVOS.map((d) => (
            <li
              key={d.nombre}
              className="flex flex-wrap items-start gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bivi-blue-soft text-bivi-blue">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {d.icono}
                </svg>
              </span>

              <div className="min-w-[11rem] flex-1">
                <p className="font-bold text-bivi-text">{d.nombre}</p>
                <p className="mt-1 text-sm leading-relaxed text-bivi-text/85">{d.paraQue}</p>
                <p className="mt-1 text-xs text-bivi-muted">{d.ejemplos}</p>
              </div>

              <button
                disabled
                className="w-full shrink-0 rounded-xl border border-bivi-border px-4 py-2.5 font-bold text-bivi-muted disabled:opacity-60 sm:w-auto sm:self-center"
              >
                Conectar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
