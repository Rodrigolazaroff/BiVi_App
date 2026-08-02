'use client';

import { useAuth } from '@/lib/auth-context';

export default function CerrarSesion() {
  const { logout } = useAuth();

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-sm sm:p-8">
      <button
        onClick={logout}
        className="w-full rounded-xl border border-bivi-border px-4 py-3 font-bold text-bivi-muted transition hover:bg-bivi-bg hover:text-bivi-text"
      >
        Cerrar sesión
      </button>
    </section>
  );
}
