'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { createClient } from '@/lib/supabase/client';
import type { Elder } from '@/lib/elder';

export default function FichaForm() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [topics, setTopics] = useState<[string, string, string]>(['', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Trae la ficha desde Supabase. RLS ya limita el resultado al elder propio.
  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error: loadError } = await supabase
        .from('elders')
        .select('id, profile_id, full_name, age, favorite_topics')
        .maybeSingle<Elder>();

      if (!active) return;

      if (loadError) {
        setError('No pudimos cargar los datos. Recargá la página.');
      } else if (data) {
        setFullName(data.full_name);
        setAge(String(data.age));
        setTopics([
          data.favorite_topics[0] ?? '',
          data.favorite_topics[1] ?? '',
          data.favorite_topics[2] ?? '',
        ]);
      }
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');

      if (!user) {
        setError('Tu sesión expiró. Volvé a ingresar.');
        return;
      }
      if (!fullName.trim() || !age) {
        setError('El nombre y la edad son obligatorios.');
        return;
      }

      setSaving(true);

      // upsert sobre profile_id: la tabla tiene UNIQUE ahi, asi que el mismo
      // formulario sirve para crear la ficha y para editarla.
      const { error: saveError } = await supabase.from('elders').upsert(
        {
          profile_id: user.id,
          full_name: fullName.trim(),
          age: Number(age),
          favorite_topics: topics.map((t) => t.trim()).filter(Boolean),
        },
        { onConflict: 'profile_id' }
      );

      if (saveError) {
        setError('No pudimos guardar los cambios. Probá de nuevo.');
      } else {
        setSuccess('Datos guardados correctamente.');
      }
      setSaving(false);
    },
    [supabase, user, fullName, age, topics]
  );

  const inputClass =
    'w-full rounded-xl border border-bivi-border bg-white px-4 py-3 text-bivi-text ' +
    'placeholder:text-bivi-muted/60 transition focus:border-bivi-blue focus:outline-none ' +
    'focus:ring-2 focus:ring-bivi-blue/30 disabled:opacity-60';

  if (loading) {
    return (
      <div className="rounded-2xl border border-bivi-border/70 bg-white p-8 shadow-sm">
        <p className="text-bivi-muted">Cargando la ficha...</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">
        Ficha del adulto mayor
      </h2>
      <p className="mt-1 mb-6 text-bivi-muted">
        Con estos datos BiVi sabe con quién está hablando.
      </p>

      <form onSubmit={handleSave} className="space-y-4" noValidate>
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-sm font-bold text-bivi-text">
            Nombre completo
          </label>
          <input
            id="fullName"
            type="text"
            placeholder="Juan Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={saving}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="age" className="mb-1.5 block text-sm font-bold text-bivi-text">
            Edad
          </label>
          <input
            id="age"
            type="number"
            placeholder="78"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min="18"
            max="120"
            required
            disabled={saving}
            className={inputClass}
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-bold text-bivi-text">
            Temas favoritos
          </legend>
          <p className="mb-2 text-sm text-bivi-muted">
            Hasta tres. Son los temas con los que BiVi arranca la charla.
          </p>
          <div className="space-y-2">
            {[0, 1, 2].map((idx) => (
              <input
                key={idx}
                type="text"
                aria-label={`Tema favorito ${idx + 1}`}
                placeholder={['fútbol, San Lorenzo', 'sus nietos', 'tango y milonga'][idx]}
                value={topics[idx]}
                onChange={(e) => {
                  const next = [...topics] as [string, string, string];
                  next[idx] = e.target.value;
                  setTopics(next);
                }}
                disabled={saving}
                className={inputClass}
              />
            ))}
          </div>
        </fieldset>

        <div aria-live="polite">
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-bivi-green-soft px-4 py-3 text-sm font-bold text-bivi-green-dark">
              {success}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-bivi-blue-dark active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  );
}
