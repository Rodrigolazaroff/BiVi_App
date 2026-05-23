'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallButton({ elderName }: { elderName: string }) {
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

    // Check if iOS
    const ua = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    // Check if already installed
    if ((window.navigator as any).getInstalledRelatedApps) {
      (window.navigator as any).getInstalledRelatedApps().then((apps: any[]) => {
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
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-green-900 mb-4">✓ BiVi instalada</h2>
        <p className="text-gray-700">
          BiVi ya está instalada en este celular. Buscá el ícono en la pantalla de inicio y tocalo para que {elderName} pueda conversar.
        </p>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-blue-900 mb-4">Instalar BiVi (iPhone/iPad)</h2>
        <div className="text-gray-700 space-y-3">
          <p className="font-semibold">Seguí estos pasos:</p>
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Tocá el botón <span className="font-semibold">Compartir</span> (ícono de flecha hacia arriba)</li>
            <li>Buscá <span className="font-semibold">Agregar a pantalla de inicio</span></li>
            <li>Tocá <span className="font-semibold">Agregar</span></li>
            <li>BiVi aparecerá como un ícono en la pantalla de inicio</li>
          </ol>
          <p className="text-sm text-gray-600 mt-4">
            Hacé esto desde el celular de {elderName} para que pueda usar BiVi fácilmente.
          </p>
        </div>
      </div>
    );
  }

  if (!installPrompt) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-blue-900 mb-4">Instalar BiVi en este celular</h2>
      <p className="text-gray-700 mb-6">
        Abrí esta página desde el celular de {elderName} y tocá el botón para instalar BiVi. Una vez instalada, BiVi va a aparecer como un ícono en la pantalla del celular.
      </p>
      <button
        onClick={handleInstall}
        className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700 transition"
      >
        INSTALAR EN ESTE CELULAR
      </button>
    </div>
  );
}
