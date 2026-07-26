'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import BiviLogo from '@/components/BiviLogo';

/**
 * Se llega aca desde el mail de recuperacion, ya con una sesion abierta que
 * dejo /auth/callback. Solo queda elegir la contraseña nueva.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputClass =
    'w-full rounded-xl border border-bivi-border bg-white px-4 py-3 text-bivi-text ' +
    'transition focus:border-bivi-blue focus:outline-none focus:ring-2 focus:ring-bivi-blue/30 ' +
    'disabled:opacity-60';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => router.replace('/dashboard'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-bivi-blue-soft via-bivi-bg to-bivi-green-soft/50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BiviLogo size={84} priority className="mb-5" />
          <h1 className="font-display text-3xl font-semibold tracking-tight text-bivi-text">
            Nueva contraseña
          </h1>
          <p className="mt-1.5 text-bivi-muted">Elegí una contraseña para tu cuenta</p>
        </div>

        <div className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
          {done ? (
            <p
              aria-live="polite"
              className="rounded-xl bg-bivi-green-soft px-4 py-3 text-center font-bold text-bivi-green-dark"
            >
              Contraseña actualizada. Te llevamos al panel...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-bold text-bivi-text">
                  Contraseña nueva
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-sm font-bold text-bivi-text">
                  Repetir contraseña
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className={inputClass}
                />
              </div>

              <div aria-live="polite">
                {error && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-bivi-blue-dark active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
