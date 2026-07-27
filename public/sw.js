// Subir esta version cuando cambie la estrategia de cache: al activarse borra
// todo lo guardado con nombres anteriores.
const CACHE_NAME = 'bivi-v2';

// Pantalla de respaldo cuando se abre la PWA sin conexion.
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
  );
  self.clients.claim();
});

// --- Notificaciones push ---------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'BiVi', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Vibracion suave: es un recordatorio de compania, no una alarma.
      vibrate: [100, 50, 100],
      data: { url: data.url || '/talk' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || '/talk';

  event.waitUntil(
    // Si la app ya esta abierta se enfoca esa pestania; si no, se abre.
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abiertas) => {
      for (const cliente of abiertas) {
        if (new URL(cliente.url).origin === self.location.origin && 'focus' in cliente) {
          cliente.navigate(destino);
          return cliente.focus();
        }
      }
      return clients.openWindow(destino);
    })
  );
});

// --- Cache -----------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca cachear otro origen ni las llamadas de autenticacion: una sesion
  // servida desde cache es una sesion equivocada.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // HTML: siempre red primero. Con cache-first, un deploy nuevo no llegaba
  // nunca a quien ya habia abierto la app.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error()))
    );
    return;
  }

  // Estaticos de Next: el nombre lleva hash, asi que si esta en cache es la
  // version correcta y no hace falta ir a la red.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Resto (iconos, imagenes): red primero, cache como respaldo offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((r) => r ?? Response.error()))
  );
});
