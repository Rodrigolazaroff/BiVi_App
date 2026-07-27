'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Activa los recordatorios push en ESTE dispositivo.
 *
 * El flujo pensado: el cuidador inicia sesion en el celular del adulto mayor,
 * instala la PWA y activa esto. A partir de ahi, el celular avisa a la hora de
 * cada toma aunque la app este cerrada.
 */

/** La clave VAPID publica viaja en base64url; el navegador la quiere en bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const limpio = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = window.atob(limpio);
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

type Estado = 'cargando' | 'no-soportado' | 'bloqueado' | 'inactivo' | 'activo' | 'trabajando';

export default function Notificaciones() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;

    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (vigente) setEstado('no-soportado');
        return;
      }
      if (Notification.permission === 'denied') {
        if (vigente) setEstado('bloqueado');
        return;
      }
      // En desarrollo el SW se desregistra (ver ServiceWorkerRegister), asi que
      // ready quedaria colgado: se consulta la registracion sin esperar.
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (vigente) setEstado(sub ? 'activo' : 'inactivo');
    })().catch(() => {
      if (vigente) setEstado('no-soportado');
    });

    return () => {
      vigente = false;
    };
  }, []);

  const activar = useCallback(async () => {
    setError('');
    setEstado('trabajando');

    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        setEstado(permiso === 'denied' ? 'bloqueado' : 'inactivo');
        return;
      }

      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register('/sw.js'));

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as BufferSource,
      });

      const respuesta = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!respuesta.ok) {
        // Si el servidor no la guardo, el navegador tampoco debe quedar
        // suscripto: quedaria un dispositivo que nunca recibe nada.
        await sub.unsubscribe();
        const body = await respuesta.json().catch(() => ({}));
        throw new Error(body.error || 'No pudimos activar los recordatorios.');
      }

      setEstado('activo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos activar los recordatorios.');
      setEstado('inactivo');
    }
  }, []);

  const desactivar = useCallback(async () => {
    setError('');
    setEstado('trabajando');

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();

      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }

      setEstado('inactivo');
    } catch {
      setError('No pudimos desactivar los recordatorios.');
      setEstado('activo');
    }
  }, []);

  if (estado === 'cargando') return null;

  return (
    <section className="rounded-2xl border border-bivi-border/70 bg-white p-6 shadow-xl shadow-bivi-blue/5 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-bivi-text">
        Recordatorios en el celular
      </h2>
      <p className="mt-1 mb-5 text-bivi-muted">
        A la hora de cada medicamento, este dispositivo avisa aunque BiVi esté cerrada.
        Activalo en el celular donde la usa el adulto mayor.
      </p>

      {estado === 'no-soportado' && (
        <p className="rounded-xl bg-bivi-bg px-4 py-4 text-bivi-muted">
          Este navegador no permite recordatorios. En iPhone, primero instalá BiVi en la
          pantalla de inicio y abrila desde ahí.
        </p>
      )}

      {estado === 'bloqueado' && (
        <p className="rounded-xl bg-amber-50 px-4 py-4 text-amber-900">
          Las notificaciones están bloqueadas para BiVi. Buscá el candado en la barra de
          direcciones y permitilas para poder activar los recordatorios.
        </p>
      )}

      {(estado === 'inactivo' || estado === 'trabajando') && (
        <button
          onClick={activar}
          disabled={estado === 'trabajando'}
          className="w-full rounded-xl bg-bivi-blue px-4 py-3.5 font-bold text-white shadow-sm transition hover:bg-bivi-blue-dark active:scale-[0.99] disabled:opacity-60"
        >
          {estado === 'trabajando' ? 'Un momento...' : 'Activar recordatorios acá'}
        </button>
      )}

      {estado === 'activo' && (
        <div className="space-y-3">
          <p className="rounded-xl bg-bivi-green-soft px-4 py-3 font-bold text-bivi-green-dark">
            ✓ Este dispositivo recibe los recordatorios.
          </p>
          <button
            onClick={desactivar}
            className="w-full rounded-xl border border-bivi-border px-4 py-3 font-bold text-bivi-muted transition hover:bg-bivi-bg hover:text-bivi-text"
          >
            Desactivar en este dispositivo
          </button>
        </div>
      )}

      <div aria-live="polite">
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
