import LoginClient from './client';

/**
 * Envoltorio de servidor: solo traduce el `?error=auth` con el que puede
 * volver /auth/callback y se lo pasa listo al formulario.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <LoginClient
      initialError={
        error === 'auth' ? 'No pudimos completar el ingreso. Probá de nuevo.' : ''
      }
    />
  );
}
