'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatearHora, type Medicamento } from '@/lib/medicamentos';

const inputClass =
  'w-full rounded-xl border border-bivi-border bg-white px-4 py-3 text-bivi-text ' +
  'placeholder:text-bivi-muted/60 transition focus:border-bivi-blue focus:outline-none ' +
  'focus:ring-2 focus:ring-bivi-blue/30 disabled:opacity-60';

export default function Medicamentos({
  elderId,
  iniciales,
}: {
  elderId: string;
  iniciales: Medicamento[];
}) {
  const supabase = useMemo(() => createClient(), []);

  // La lista llega ya resuelta desde el servidor, asi que no hace falta un
  // efecto que la busque al montar ni una pantalla de carga intermedia. Solo se
  // vuelve a consultar despues de agregar o quitar algo.
  const [lista, setLista] = useState<Medicamento[]>(iniciales);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [dosis, setDosis] = useState('');
  const [horarios, setHorarios] = useState<string[]>(['']);

  const cargar = useCallback(async () => {
    const { data, error: fallo } = await supabase
      .from('medications')
      .select('id, nombre, dosis, horarios, activo')
      .eq('activo', true)
      .order('created_at');

    if (fallo) setError('No pudimos actualizar la lista.');
    else setLista((data ?? []) as Medicamento[]);
  }, [supabase]);

  async function agregar(evento: React.FormEvent) {
    evento.preventDefault();
    setError('');

    const horas = horarios.filter(Boolean);
    if (!nombre.trim()) return setError('Poné el nombre del medicamento.');
    if (horas.length === 0) return setError('Agregá al menos un horario.');

    setGuardando(true);
    const { error: fallo } = await supabase.from('medications').insert({
      elder_id: elderId,
      nombre: nombre.trim(),
      dosis: dosis.trim(),
      // La base guarda `time`, que necesita segundos.
      horarios: horas.map((h) => `${h}:00`),
    });

    if (fallo) {
      setError('No pudimos guardar el medicamento.');
    } else {
      setNombre('');
      setDosis('');
      setHorarios(['']);
      await cargar();
    }
    setGuardando(false);
  }

  async function quitar(id: string) {
    // Se marca inactivo en vez de borrar: las tomas ya registradas siguen
    // teniendo sentido en el historial.
    const { error: fallo } = await supabase
      .from('medications')
      .update({ activo: false })
      .eq('id', id);
    if (fallo) setError('No pudimos quitar el medicamento.');
    else await cargar();
  }

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">Medicamentos</h2>
      <p className="mt-1 mb-6 text-bivi-muted">
        BiVi los menciona en la charla y anota si los tomó. Nunca da indicaciones médicas.
      </p>

      {lista.length > 0 && (
        <ul className="mb-6 divide-y divide-bivi-border/60">
              {lista.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-bold text-bivi-text">
                      {m.nombre}
                      {m.dosis && <span className="font-normal text-bivi-muted"> · {m.dosis}</span>}
                    </p>
                    <p className="text-sm text-bivi-muted">
                      {m.horarios.map(formatearHora).join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => quitar(m.id)}
                    className="shrink-0 text-sm font-bold text-bivi-muted underline-offset-2 hover:text-red-700 hover:underline"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={agregar} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="med-nombre" className="mb-1.5 block text-sm font-bold text-bivi-text">
                  Medicamento
                </label>
                <input
                  id="med-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Enalapril"
                  disabled={guardando}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="med-dosis" className="mb-1.5 block text-sm font-bold text-bivi-text">
                  Dosis <span className="font-normal text-bivi-muted">(opcional)</span>
                </label>
                <input
                  id="med-dosis"
                  value={dosis}
                  onChange={(e) => setDosis(e.target.value)}
                  placeholder="1 comprimido"
                  disabled={guardando}
                  className={inputClass}
                />
              </div>
            </div>

            <fieldset>
              <legend className="mb-1.5 block text-sm font-bold text-bivi-text">Horarios</legend>
              <div className="space-y-2">
                {horarios.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="time"
                      value={h}
                      aria-label={`Horario ${i + 1}`}
                      onChange={(e) => {
                        const next = [...horarios];
                        next[i] = e.target.value;
                        setHorarios(next);
                      }}
                      disabled={guardando}
                      className={inputClass}
                    />
                    {horarios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setHorarios(horarios.filter((_, j) => j !== i))}
                        aria-label={`Quitar horario ${i + 1}`}
                        className="shrink-0 rounded-xl border border-bivi-border px-4 font-bold text-bivi-muted hover:text-red-700"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setHorarios([...horarios, ''])}
                className="mt-2 text-sm font-bold text-bivi-blue underline-offset-2 hover:underline"
              >
                + Agregar otro horario
              </button>
            </fieldset>

            <div aria-live="polite">
              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-bivi-blue-dark active:scale-[0.99] disabled:opacity-60"
            >
              {guardando ? 'Guardando...' : 'Agregar medicamento'}
            </button>
          </form>
    </section>
  );
}
