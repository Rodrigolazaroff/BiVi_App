'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import BiviLogo from '@/components/BiviLogo';
import GoogleIcon from '@/components/GoogleIcon';

type Mode = 'login' | 'signup' | 'forgot';

const COPY: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  login: {
    title: 'Bienvenido de nuevo',
    subtitle: 'Ingresá para administrar BiVi',
    cta: 'Ingresar',
  },
  signup: {
    title: 'Creá tu cuenta',
    subtitle: 'Configurá BiVi para quien vos querés acompañar',
    cta: 'Crear cuenta',
  },
  forgot: {
    title: 'Recuperar contraseña',
    subtitle: 'Te enviamos un enlace para elegir una nueva',
    cta: 'Enviar enlace',
  },
};

const inputClass =
  'w-full rounded-xl border border-bivi-border bg-white px-4 py-3 text-bivi-text ' +
  'placeholder:text-bivi-muted/60 transition ' +
  'focus:border-bivi-blue focus:outline-none focus:ring-2 focus:ring-bivi-blue/30 ' +
  'disabled:opacity-60';

const labelClass = 'mb-1.5 block text-sm font-bold text-bivi-text';

export default function LoginClient({ initialError = '' }: { initialError?: string }) {
  const router = useRouter();
  const { login, signup, loginWithGoogle, sendPasswordReset } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Si /auth/callback fallo vuelve con ?error=auth. El mensaje lo resuelve el
  // Server Component y llega ya listo, sin efecto ni parpadeo.
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setShowPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        await sendPasswordReset(email);
        setNotice(
          'Listo. Si existe una cuenta con ese email, va a llegarte un enlace en los próximos minutos.'
        );
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signup(email, firstName, lastName, password);
        if (needsConfirmation) {
          setNotice('Te enviamos un correo para confirmar la cuenta. Revisá tu bandeja.');
        } else {
          router.replace('/dashboard');
        }
      } else {
        await login(email, password);
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal. Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setNotice('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // El navegador se va a Google: no hace falta apagar el loading.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos abrir el ingreso con Google.');
      setGoogleLoading(false);
    }
  }

  const copy = COPY[mode];
  const busy = loading || googleLoading;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-bivi-blue-soft via-bivi-bg to-bivi-green-soft/50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BiviLogo size={84} priority className="mb-5" />
          <h1 className="font-display text-3xl font-semibold tracking-tight text-bivi-text">
            {copy.title}
          </h1>
          <p className="mt-1.5 text-bivi-muted">{copy.subtitle}</p>
        </div>

        <div className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-bivi-border bg-white px-4 py-3 font-bold text-bivi-text transition hover:bg-bivi-bg active:scale-[0.99] disabled:opacity-60"
              >
                <GoogleIcon className="h-5 w-5" />
                {googleLoading ? 'Abriendo Google...' : 'Continuar con Google'}
              </button>

              <div className="my-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-bivi-border" />
                <span className="text-sm text-bivi-muted">o</span>
                <span className="h-px flex-1 bg-bivi-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="firstName" className={labelClass}>
                    Nombre
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={busy}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClass}>
                    Apellido
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={busy}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
                className={inputClass}
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <label htmlFor="password" className={labelClass + ' mb-0'}>
                    Contraseña
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-sm font-bold text-bivi-blue underline-offset-2 hover:underline"
                    >
                      ¿La olvidaste?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={busy}
                    className={inputClass + ' pr-12'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center text-bivi-muted transition hover:text-bivi-text"
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            )}

            {/* aria-live: el lector de pantalla anuncia el resultado sin mover el foco. */}
            <div aria-live="polite">
              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-xl bg-bivi-green-soft px-4 py-3 text-sm font-bold text-bivi-green-dark">
                  {notice}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-bivi-blue-dark active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? 'Un momento...' : copy.cta}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-bivi-muted">
          {mode === 'login' && (
            <>
              ¿No tenés cuenta?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="font-bold text-bivi-blue underline-offset-2 hover:underline"
              >
                Registrate
              </button>
            </>
          )}
          {mode === 'signup' && (
            <>
              ¿Ya tenés cuenta?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-bold text-bivi-blue underline-offset-2 hover:underline"
              >
                Ingresá
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="font-bold text-bivi-blue underline-offset-2 hover:underline"
            >
              Volver al ingreso
            </button>
          )}
        </p>
      </div>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.3M6.6 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a10.7 10.7 0 0 0 5.4-1.4" />
      <path d="m2 2 20 20" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
