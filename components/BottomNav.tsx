'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Navegacion inferior del panel, estilo app instalada.
 *
 * Siempre icono + texto: un icono solo obliga a adivinar, y el publico de BiVi
 * (cuidadores, muchos tambien mayores) no tiene por que conocer la convencion.
 * Los targets son altos (64px+) por el mismo motivo.
 */

const TABS = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icono: (
      <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />
    ),
  },
  {
    href: '/dashboard/salud',
    label: 'Salud',
    icono: (
      <path d="M12 21C7 16.6 3 13.3 3 9.3 3 6.4 5.2 4 8 4c1.6 0 3.1.8 4 2 .9-1.2 2.4-2 4-2 2.8 0 5 2.4 5 5.3 0 4-4 7.3-9 11.7Z" />
    ),
  },
  {
    href: '/dashboard/ficha',
    label: 'Ficha',
    icono: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </>
    ),
  },
  {
    href: '/dashboard/cuenta',
    label: 'Cuenta',
    icono: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones del panel"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-bivi-border/70 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          // /dashboard matchea exacto; el resto tambien cubre subrutas.
          const activa =
            tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={activa ? 'page' : undefined}
              className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 transition ${
                activa ? 'text-bivi-blue' : 'text-bivi-muted hover:text-bivi-text'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={activa ? 2.4 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {tab.icono}
              </svg>
              <span className={`text-xs ${activa ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
