'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  describirPeriodo,
  formatearHora,
  vigenteEn,
  type Medicamento,
} from '@/lib/medicamentos';

type Duracion = 'permanente' | 'temporal';

const inputClass =
  'w-full rounded-xl border border-bivi-border bg-white px-4 py-3 text-bivi-text ' +
  'placeholder:text-bivi-muted/60 transition focus:border-bivi-blue focus:outline-none ' +
  'focus:ring-2 focus:ring-bivi-blue/30 disabled:opacity-60';

export default function Medicamentos({
  elderId,
  iniciales,
  hoy,
}: {
  elderId: string;
  iniciales: Medicamento[];
  /** "YYYY-MM-DD" en hora de Argentina, sellado en el servidor. */
  hoy: string;
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
  const [duracion, setDuracion] = useState<Duracion>('permanente');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState('');

  const cargar = useCallback(async () => {
    const { data, error: fallo } = await supabase
      .from('medications')
      .select('id, nombre, dosis, horarios, activo, desde, hasta')
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
    if (duracion === 'temporal' && !hasta) {
      return setError('Poné hasta qué día lo tiene que tomar.');
    }
    if (duracion === 'temporal' && hasta < desde) {
      return setError('La fecha de fin no puede ser anterior a la de inicio.');
    }

    setGuardando(true);
    const { error: fallo } = await supabase.from('medications').insert({
      elder_id: elderId,
      nombre: nombre.trim(),
      dosis: dosis.trim(),
      // La base guarda `time`, que necesita segundos.
      horarios: horas.map((h) => `${h}:00`),
      desde,
      // null = permanente: no tiene fecha de fin.
      hasta: duracion === 'permanente' ? null : hasta,
    });

    if (fallo) {
      setError('No pudimos guardar el medicamento.');
    } else {
      setNombre('');
      setDosis('');
      setHorarios(['']);
      setDuracion('permanente');
      setDesde(hoy);
      setHasta('');
      await cargar();
    }
    setGuardando(false);
  }

  /** Atajo para tratamientos cortos: "por 5 días" calcula la fecha de fin. */
  function porDias(dias: number) {
    setDuracion('temporal');
    const fin = new Date(`${desde}T12:00:00`);
    fin.setDate(fin.getDate() + dias - 1);
    setHasta(fin.toISOString().slice(0, 10));
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
          {lista.map((m) => {
            const vigente = vigenteEn(m, hoy);
            return (
              <li key={m.id} className="flex items-start justify-between gap-4 py-3">
                {/* Los terminados quedan atenuados pero visibles: que un
                    medicamento desaparezca solo confundiria al cuidador. */}
                <div className={vigente ? '' : 'opacity-55'}>
                  <p className="font-bold text-bivi-text">
                    {m.nombre}
                    {m.dosis && <span className="font-normal text-bivi-muted"> · {m.dosis}</span>}
                  </p>
                  <p className="text-sm text-bivi-muted">
                    {m.horarios.map(formatearHora).join(' · ')}
                  </p>
                  <p className="mt-1">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        !vigente
                          ? 'bg-bivi-bg text-bivi-muted'
                          : m.hasta === null
                            ? 'bg-bivi-blue-soft text-bivi-blue'
                            : 'bg-bivi-green-soft text-bivi-green-dark'
                      }`}
                    >
                      {describirPeriodo(m, hoy)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => quitar(m.id)}
                  className="shrink-0 text-sm font-bold text-bivi-muted underline-offset-2 hover:text-red-700 hover:underline"
                >
                  Quitar
                </button>
              </li>
            );
          })}
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

            <fieldset>
              <legend className="mb-1.5 block text-sm font-bold text-bivi-text">
                ¿Por cuánto tiempo?
              </legend>

              <div className="mb-3 flex gap-2">
                <OpcionDuracion
                  activa={duracion === 'permanente'}
                  onClick={() => setDuracion('permanente')}
                  titulo="Permanente"
                  detalle="presión, diabetes"
                />
                <OpcionDuracion
                  activa={duracion === 'temporal'}
                  onClick={() => setDuracion('temporal')}
                  titulo="Por un tiempo"
                  detalle="antibiótico, analgésico"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="med-desde" className="mb-1.5 block text-sm text-bivi-muted">
                    Empieza
                  </label>
                  <input
                    id="med-desde"
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    disabled={guardando}
                    className={inputClass}
                  />
                </div>
                {duracion === 'temporal' && (
                  <div>
                    <label htmlFor="med-hasta" className="mb-1.5 block text-sm text-bivi-muted">
                      Termina
                    </label>
                    <input
                      id="med-hasta"
                      type="date"
                      value={hasta}
                      min={desde}
                      onChange={(e) => setHasta(e.target.value)}
                      disabled={guardando}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {duracion === 'temporal' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="py-1 text-sm text-bivi-muted">Atajos:</span>
                  {[3, 5, 7, 10, 14].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => porDias(d)}
                      className="rounded-full border border-bivi-border px-3 py-1 text-sm font-bold text-bivi-blue transition hover:bg-bivi-blue-soft"
                    >
                      {d} días
                    </button>
                  ))}
                </div>
              )}
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

function OpcionDuracion({
  activa,
  onClick,
  titulo,
  detalle,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex-1 rounded-xl border px-4 py-3 text-left transition ${
        activa
          ? 'border-bivi-blue bg-bivi-blue-soft'
          : 'border-bivi-border bg-white hover:bg-bivi-bg'
      }`}
    >
      <span className={`block font-bold ${activa ? 'text-bivi-blue' : 'text-bivi-text'}`}>
        {titulo}
      </span>
      <span className="block text-xs text-bivi-muted">{detalle}</span>
    </button>
  );
}
