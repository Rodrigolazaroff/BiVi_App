'use client';

import { useRef, useState } from 'react';
import VisorHistoria from './VisorHistoria';
import { formatearFecha, type Historia } from '@/lib/historia';

/**
 * Genera la historia clinica y ofrece verla en el visor flotante.
 *
 * La tarjeta de la pagina solo resume que quedo armado; el documento completo
 * vive en <VisorHistoria>, que es tambien lo que se imprime.
 */

export default function HistoriaClinica() {
  const [historia, setHistoria] = useState<Historia | null>(null);
  const [viendo, setViendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const botonVer = useRef<HTMLButtonElement>(null);

  async function generar() {
    setError('');
    setCargando(true);
    try {
      const r = await fetch('/api/historia', { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(body.error || 'No pudimos generar la historia clínica.');
        return;
      }
      setHistoria(body.historia as Historia);
      setViendo(true);
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">Historia clínica</h2>
      <p className="mt-1 mb-5 text-bivi-muted">
        Junta la ficha, la medicación y los documentos subidos en un resumen ordenado para
        llevar a la consulta.
      </p>

      <button
        onClick={generar}
        disabled={cargando}
        className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white shadow-sm transition-transform duration-150 ease-out hover:bg-bivi-blue-dark active:scale-[0.99] disabled:opacity-60"
      >
        {cargando
          ? 'Armando el resumen...'
          : historia
            ? 'Generar de nuevo'
            : 'Generar historia clínica'}
      </button>

      <div aria-live="polite">
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </p>
        )}
      </div>

      {historia && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bivi-border/70 bg-bivi-bg/60 px-4 py-3.5">
          <div className="min-w-0">
            <p className="font-bold text-bivi-text">{historia.paciente.nombre}</p>
            <p className="text-sm text-bivi-muted">
              Generada el {formatearFecha(historia.generadaEl)} ·{' '}
              {historia.medicacion.length} en medicación · {historia.estudios.length} estudios
            </p>
          </div>
          <button
            ref={botonVer}
            onClick={() => setViendo(true)}
            className="rounded-xl bg-bivi-blue px-6 py-2.5 font-bold text-white shadow-sm transition-transform duration-150 ease-out hover:bg-bivi-blue-dark active:scale-[0.97]"
          >
            Ver
          </button>
        </div>
      )}

      {historia && viendo && (
        <VisorHistoria
          historia={historia}
          onCerrar={() => {
            setViendo(false);
            botonVer.current?.focus();
          }}
        />
      )}
    </section>
  );
}
