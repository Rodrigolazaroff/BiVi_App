'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import HistoriaDocumento from './HistoriaDocumento';
import type { Historia } from '@/lib/historia';

/**
 * Capa flotante que muestra la historia clinica por encima de la pantalla
 * actual. Al cerrarla el cuidador vuelve exactamente a donde estaba: nunca
 * navega, solo se monta y desmonta encima.
 *
 * Va en un portal sobre <body> para que ningun contenedor con overflow o
 * transform de la pagina lo recorte.
 */

/** La salida es mas rapida que la entrada: entrar acompania, salir responde. */
const SALIDA_MS = 160;

/** Nunca hay que resuscribirse: el valor cambia una sola vez, al hidratar. */
const sinSuscripcion = () => () => {};

export default function VisorHistoria({
  historia,
  onCerrar,
}: {
  historia: Historia;
  onCerrar: () => void;
}) {
  // `montado` existe para el portal: en el servidor no hay DOM, asi que el
  // primer render es null en los dos lados y no hay desajuste de hidratacion.
  const montado = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false
  );
  const [visible, setVisible] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const cerrando = useRef(false);

  // Un frame de margen: sin el, React pinta el estado final y no hay transicion.
  // El setTimeout es el respaldo para cuando la pestania esta en segundo plano
  // y no se llama a requestAnimationFrame: ahi no hay animacion, pero tampoco
  // queda el visor invisible.
  useEffect(() => {
    if (!montado) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    const respaldo = setTimeout(() => setVisible(true), 80);
    panel.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(respaldo);
    };
  }, [montado]);

  // El fondo no scrollea mientras el visor esta abierto.
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, []);

  const cerrar = useCallback(() => {
    if (cerrando.current) return;
    cerrando.current = true;
    setVisible(false);
    setTimeout(onCerrar, SALIDA_MS);
  }, [onCerrar]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [cerrar]);

  if (!montado) return null;

  return createPortal(
    <div id="visor-historia" className="fixed inset-0 z-50 print:static print:z-auto">
      <div
        onClick={cerrar}
        aria-hidden
        className={`absolute inset-0 bg-bivi-text/45 transition-opacity duration-200 ease-out print:hidden ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div className="absolute inset-0 flex sm:items-center sm:justify-center sm:p-6 print:static print:block print:p-0">
        <div
          ref={panel}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Historia clínica de ${historia.paciente.nombre}`}
          className={[
            'relative flex w-full flex-col bg-white outline-none',
            'sm:max-h-full sm:max-w-3xl sm:rounded-2xl sm:shadow-2xl sm:shadow-bivi-text/20',
            'transition-[opacity,translate] ease-[cubic-bezier(0.23,1,0.32,1)]',
            visible
              ? 'translate-y-0 opacity-100 duration-[260ms]'
              : 'translate-y-3 opacity-0 duration-[160ms]',
            'print:max-h-none print:translate-y-0 print:opacity-100 print:shadow-none',
          ].join(' ')}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-bivi-border/70 px-4 py-3 sm:px-6 print:hidden">
            <p className="font-display text-lg font-semibold text-bivi-text">Historia clínica</p>
            <button
              onClick={cerrar}
              aria-label="Cerrar y volver"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-bivi-muted transition-transform duration-150 ease-out hover:bg-bivi-bg hover:text-bivi-text active:scale-[0.94]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-7 sm:px-9 sm:py-9 print:overflow-visible print:p-0">
            <HistoriaDocumento historia={historia} />
          </div>

          <footer className="flex shrink-0 gap-3 border-t border-bivi-border/70 px-4 py-3 sm:px-6 print:hidden">
            <button
              onClick={cerrar}
              className="flex-1 rounded-xl border border-bivi-border px-4 py-3 font-bold text-bivi-text transition-transform duration-150 ease-out hover:bg-bivi-bg active:scale-[0.98]"
            >
              Volver
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-xl bg-bivi-blue px-4 py-3 font-bold text-white shadow-sm transition-transform duration-150 ease-out hover:bg-bivi-blue-dark active:scale-[0.98]"
            >
              Guardar PDF
            </button>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
}
