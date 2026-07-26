'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signup: (
    email: string,
    firstName: string,
    lastName: string,
    password: string
  ) => Promise<{ needsConfirmation: boolean }>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Los errores de Supabase llegan en ingles y bastante tecnicos. Se traducen
 * aca para que el cuidador lea algo accionable.
 */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();

  if (m.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (m.includes('email not confirmed')) {
    return 'Todavía no confirmaste tu email. Revisá tu correo.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Ya existe una cuenta con ese email. Probá ingresando.';
  }
  if (m.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'Ese email no parece válido.';
  }
  if (m.includes('email rate limit') || m.includes('too many requests')) {
    return 'Demasiados intentos seguidos. Esperá un momento y volvé a probar.';
  }
  if (m.includes('same password')) {
    return 'La contraseña nueva tiene que ser distinta de la anterior.';
  }
  if (m.includes('provider is not enabled')) {
    return 'El ingreso con Google todavía no está habilitado.';
  }
  if (m.includes('fetch') || m.includes('network')) {
    return 'No pudimos conectarnos. Revisá tu conexión a internet.';
  }
  return message;
}

/** El nombre puede venir del alta con email o del perfil de Google. */
function toUser(supabaseUser: SupabaseUser): User {
  const meta = supabaseUser.user_metadata ?? {};
  const fullName: string = meta.full_name ?? meta.name ?? '';
  const [firstFromFull, ...restFromFull] = fullName.split(' ').filter(Boolean);

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    firstName: meta.first_name || firstFromFull || '',
    lastName: meta.last_name || restFromFull.join(' ') || '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ? toUser(data.user) : null);
      setIsLoading(false);
    });

    // Mantiene la sesion sincronizada entre pestañas y tras refrescar el token.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ? toUser(session.user) : null);
      setIsLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signup = useCallback(
    async (email: string, firstName: string, lastName: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // El trigger handle_new_user() lee esto para armar el profile.
        options: { data: { first_name: firstName, last_name: lastName } },
      });
      if (error) throw new Error(translateAuthError(error.message));

      // Sin sesion en la respuesta, Supabase esta pidiendo confirmar por mail.
      // Asi el login funciona con la confirmacion activada o desactivada.
      if (!data.session) return { needsConfirmation: true };

      router.refresh();
      return { needsConfirmation: false };
    },
    [supabase, router]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(translateAuthError(error.message));
      router.refresh();
    },
    [supabase, router]
  );

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(translateAuthError(error.message));
  }, [supabase]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw new Error(translateAuthError(error.message));
    },
    [supabase]
  );

  const updatePassword = useCallback(
    async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(translateAuthError(error.message));
    },
    [supabase]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
    router.refresh();
  }, [supabase, router]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      signup,
      login,
      loginWithGoogle,
      sendPasswordReset,
      updatePassword,
      logout,
    }),
    [
      user,
      isLoading,
      signup,
      login,
      loginWithGoogle,
      sendPasswordReset,
      updatePassword,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
