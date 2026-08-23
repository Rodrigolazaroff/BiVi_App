import type { ReactNode } from 'react';

/**
 * Conectar: los aparatos de la casa que pueden sumarse a BiVi.
 *
 * IMPORTANTE: todavia no hay ninguna integracion real. Cada tarjeta explica
 * que haria el aparato y queda marcada como "Próximamente" en vez de ofrecer
 * un boton que no conecta nada. Un interruptor que finge vincular una camara
 * de seguridad seria, en esta app, una mentira con consecuencias.
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
  {
    nombre: 'Botón de emergencia',
    paraQue: 'Un aviso al instante si se cae o necesita ayuda, esté donde esté.',
    ejemplos: 'colgantes y sensores de caída',
    icono: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
  },
  {
    nombre: 'Tensiómetro y glucómetro',
    paraQue: 'Que las mediciones entren solas a la historia clínica, con su fecha.',
    ejemplos: 'Omron, Accu-Chek',
    icono: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="3" />
        <path d="M6 12h2.8l1.4-3.2 2.2 6.4 1.4-3.2H18" />
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

      <div className="space-y-6">
        <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-bivi-text">
            Todavía no hay conexiones disponibles
          </h2>
          <p className="mt-1 text-bivi-muted">
            Estamos trabajando en las primeras. Acá vas a ver qué se puede conectar y qué
            aporta cada cosa; cuando alguna esté lista, aparece el botón para vincularla.
          </p>
        </section>

        <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-bivi-text">
            Qué se va a poder conectar
          </h2>
          <p className="mt-1 mb-6 text-bivi-muted">
            Nada se conecta solo: cada aparato lo vinculás vos, y podés desconectarlo cuando
            quieras.
          </p>

          <ul className="divide-y divide-bivi-border/60 border-y border-bivi-border/60">
            {DISPOSITIVOS.map((d) => (
              <li key={d.nombre} className="flex items-start gap-4 py-4">
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

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-bold text-bivi-text">{d.nombre}</p>
                    <span className="shrink-0 rounded-full bg-bivi-bg px-2.5 py-0.5 text-xs font-bold text-bivi-muted">
                      Próximamente
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-bivi-text/85">{d.paraQue}</p>
                  <p className="mt-1 text-xs text-bivi-muted">Por ejemplo: {d.ejemplos}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-bivi-text">Sobre la privacidad</h2>
          <p className="mt-1 text-bivi-muted">
            Lo que BiVi conversa con el adulto mayor no se guarda, y eso no cambia por
            conectar un aparato. De cada dispositivo va a entrar solo el dato que sirve para
            el cuidado, y siempre vas a poder ver cuál es.
          </p>
        </section>
      </div>
    </>
  );
}
