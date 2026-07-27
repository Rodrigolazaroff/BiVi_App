import webpush from 'web-push';

/**
 * Envio de notificaciones push desde el servidor.
 *
 * VAPID identifica a BiVi ante los servidores de push de cada navegador
 * (Google, Mozilla, Apple). La clave privada firma cada envio; la publica es
 * la misma que usa el navegador al suscribirse.
 */

let configurado = false;

function configurar(): boolean {
  if (configurado) return true;

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;

  webpush.setVapidDetails('mailto:rodrigolazaroff@gmail.com', publica, privada);
  configurado = true;
  return true;
}

export interface SuscripcionGuardada {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface AvisoPush {
  titulo: string;
  cuerpo: string;
  /** Ruta interna que abre el tap en la notificacion. */
  url?: string;
}

/**
 * Envia un aviso a un dispositivo.
 *
 * Devuelve 'ok', 'baja' (la suscripcion ya no existe: hay que borrarla de la
 * base) o 'error' (transitorio, no hay que tocar nada).
 */
export async function enviarAviso(
  sub: SuscripcionGuardada,
  aviso: AvisoPush
): Promise<'ok' | 'baja' | 'error'> {
  if (!configurar()) return 'error';

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: aviso.titulo,
        body: aviso.cuerpo,
        url: aviso.url ?? '/talk',
      })
    );
    return 'ok';
  } catch (err) {
    // 404/410 = el navegador dio de baja la suscripcion (app desinstalada,
    // permiso revocado). Se informa para que el caller la limpie.
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) return 'baja';

    console.error('Error enviando push:', err);
    return 'error';
  }
}
