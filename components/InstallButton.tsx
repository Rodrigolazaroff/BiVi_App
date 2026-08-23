'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallButton({ elderName: nombre }: { elderName?: string }) {
  // Sin ficha cargada todavia, el texto usa un generico en vez de un hueco.
  const elderName = nombre || 'el adulto mayor';
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    // Detectar iOS solo puede pasar en el cliente, despues de hidratar: en el
    // servidor no hay navigator, y leerlo en el initializer del useState daria
    // un mismatch de hidratacion. El re-render extra al montar es el costo.
    const ua = navigator.userAgent.toLowerCase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    // Check if already installed
    const nav = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<unknown[]>;
    };
    if (nav.getInstalledRelatedApps) {
      nav.getInstalledRelatedApps().then((apps) => {
        if (apps.length > 0) {
          setInstalled(true);
        }
      });
    }

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setInstallPrompt(null);
  };

  if (installed) {
    return (
      <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-bivi-text">BiVi instalada</h2>
        <p className="mt-1 text-bivi-muted">
          Ya está en este celular. Buscá el ícono en la pantalla de inicio y tocalo para que{' '}
          {elderName} pueda conversar.
        </p>
      </section>
    );
  }

  if (isIOS) {
    return (
      <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
        <h2 className="font-display text-2xl font-semibold text-bivi-text">
          Instalar BiVi en iPhone o iPad
        </h2>
        <p className="mt-1 mb-5 text-bivi-muted">
          Hacé esto desde el celular de {elderName}, para que le quede a mano.
        </p>

        <ol className="space-y-3">
          {[
            <>
              Tocá el botón <strong>Compartir</strong>, el de la flecha hacia arriba.
            </>,
            <>
              Buscá <strong>Agregar a pantalla de inicio</strong>.
            </>,
            <>
              Tocá <strong>Agregar</strong>.
            </>,
            <>BiVi aparece como un ícono más en la pantalla.</>,
          ].map((paso, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bivi-blue-soft text-sm font-bold text-bivi-blue tabular-nums">
                {i + 1}
              </span>
              <span className="pt-0.5 text-bivi-text">{paso}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (!installPrompt) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">
        Instalar BiVi en este celular
      </h2>
      <p className="mt-1 mb-5 text-bivi-muted">
        Abrí esta página desde el celular de {elderName} y tocá el botón. BiVi queda como un
        ícono en la pantalla, igual que cualquier otra app.
      </p>
      <button
        onClick={handleInstall}
        className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-bivi-blue-dark active:scale-[0.99]"
      >
        Instalar en este celular
      </button>
    </section>
  );
}
