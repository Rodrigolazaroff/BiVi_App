'use client';

import { useState, type ReactNode } from 'react';

/**
 * Genera la historia clinica resumida y la muestra lista para imprimir.
 *
 * La redaccion llega en Markdown acotado (##, -, **) y se renderiza con un
 * parser minimo propio: sumar una dependencia entera para cuatro construcciones
 * no se justifica.
 */

function negritas(texto: string, keyBase: string): ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
    i % 2 === 1 ? <strong key={`${keyBase}-${i}`}>{parte}</strong> : parte
  );
}

function renderizarMarkdown(md: string): ReactNode[] {
  const bloques: ReactNode[] = [];
  let listaActual: string[] = [];

  const cerrarLista = (key: string) => {
    if (listaActual.length === 0) return;
    const items = listaActual;
    listaActual = [];
    bloques.push(
      <ul key={key} className="mb-4 list-disc space-y-1.5 pl-5">
        {items.map((item, i) => (
          <li key={i}>{negritas(item, `${key}-${i}`)}</li>
        ))}
      </ul>
    );
  };

  md.split('\n').forEach((linea, n) => {
    const limpia = linea.trim();

    // Gemini alterna entre "- " y "* " como vinieta segun el dia.
    if (limpia.startsWith('- ') || limpia.startsWith('* ')) {
      listaActual.push(limpia.slice(2));
      return;
    }
    cerrarLista(`ul-${n}`);

    if (limpia.startsWith('##')) {
      bloques.push(
        <h3 key={n} className="mt-6 mb-2 font-display text-xl font-semibold text-bivi-text first:mt-0">
          {limpia.replace(/^#+\s*/, '')}
        </h3>
      );
    } else if (limpia) {
      bloques.push(
        <p key={n} className="mb-3">
          {negritas(limpia, `p-${n}`)}
        </p>
      );
    }
  });
  cerrarLista('ul-final');

  return bloques;
}

export default function HistoriaClinica() {
  const [historia, setHistoria] = useState('');
  const [generada, setGenerada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

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
      setHistoria(body.historia);
      setGenerada(body.generadaEl);
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
        className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-bivi-blue-dark active:scale-[0.99] disabled:opacity-60"
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
        <>
          <article
            id="zona-impresion"
            className="mt-6 rounded-xl border border-bivi-border/70 bg-bivi-bg/50 p-5 text-bivi-text sm:p-6 print:border-0 print:bg-white print:p-0"
          >
            <h2 className="mb-1 font-display text-2xl font-semibold">
              Historia clínica resumida
            </h2>
            <p className="mb-5 text-sm text-bivi-muted">
              Generada el {generada.split('-').reverse().map(Number).join('/')} con BiVi.
            </p>

            {renderizarMarkdown(historia)}

            <p className="mt-6 border-t border-bivi-border/70 pt-4 text-sm text-bivi-muted">
              Este resumen solo ordena la información cargada por el cuidador. No es un
              documento médico ni reemplaza la consulta profesional.
            </p>
          </article>

          <button
            onClick={() => window.print()}
            className="mt-4 w-full rounded-xl border border-bivi-border px-4 py-3 font-bold text-bivi-text transition hover:bg-bivi-bg"
          >
            Imprimir o guardar como PDF
          </button>
        </>
      )}
    </section>
  );
}
