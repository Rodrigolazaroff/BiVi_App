/**
 * Voz del navegador: sintesis (que hable) y reconocimiento (que escuche).
 *
 * Todo lo delicado de las Web Speech APIs vive aca, porque son APIs con muchos
 * casos borde que varian entre navegadores y que en un celular aparecen mucho
 * mas seguido que en escritorio.
 */

/** Error con un mensaje ya escrito para mostrarle a la persona. */
export class SpeechError extends Error {}

// ---------------------------------------------------------------------------
// Sintesis de voz
// ---------------------------------------------------------------------------

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/**
 * La primera llamada a getVoices() suele devolver una lista vacia: el navegador
 * las carga de forma asincronica y recien despues dispara 'voiceschanged'.
 * Pedirlas una sola vez y sin esperar era el motivo por el que BiVi podia
 * arrancar hablando en ingles en la primera conversacion.
 */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    const ready = window.speechSynthesis.getVoices();
    if (ready.length > 0) return resolve(ready);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
    // Hay navegadores donde el evento no llega nunca. Sin este corte, la
    // promesa quedaria pendiente y la app no hablaria jamas.
    setTimeout(finish, 2000);
  });

  return voicesPromise;
}

/**
 * Preferencia de acento, de mas a menos parecido al de quien va a escuchar.
 * BiVi habla en argentino, asi que una voz espaniola suena ajena.
 */
const PREFERENCIAS = ['es-ar', 'es-419', 'es-us', 'es-mx', 'es-cl', 'es-es', 'es'];

export async function getSpanishVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  if (voices.length === 0) return null;

  for (const prefijo of PREFERENCIAS) {
    const match = voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(prefijo));
    if (match) return match;
  }

  return voices.find((v) => v.name.toLowerCase().includes('spanish')) ?? null;
}

/** Estima cuanto puede tardar en decir un texto, para el corte de seguridad. */
function duracionMaxima(text: string): number {
  return Math.max(6000, text.length * 130);
}

/**
 * Dice un texto y resuelve cuando termina.
 *
 * Nunca rechaza ni queda pendiente: si la sintesis falla o el navegador se
 * come el evento de fin, resuelve igual. Antes, un 'error' sin handler dejaba
 * la promesa colgada y la pantalla se quedaba para siempre en "BiVi habla...".
 */
export function speak(text: string, voice: SpeechSynthesisVoice | null): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let guard: ReturnType<typeof setTimeout>;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      resolve();
    };

    try {
      // Chrome a veces deja la cola trabada; limpiarla evita que no suene nada.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice?.lang ?? 'es-AR';
      utterance.rate = 0.9;
      utterance.onend = finish;
      utterance.onerror = finish;

      guard = setTimeout(finish, duracionMaxima(text));
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  });
}

// ---------------------------------------------------------------------------
// Reconocimiento de voz
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionCtor = new () => any;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  // iPadOS 13+ se presenta como Mac, se lo distingue por el soporte tactil.
  return /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function soportaReconocimiento(): boolean {
  return getRecognitionCtor() !== null;
}

export function crearReconocimiento(): any | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  // es-AR reconoce mejor el voseo y el acento rioplatense que es-ES.
  recognition.lang = 'es-AR';
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

/**
 * start() lanza InvalidStateError si el reconocimiento ya estaba activo. Pasaba
 * cuando el reinicio automatico de onend se cruzaba con un start() explicito, y
 * cortaba la conversacion sin explicacion.
 */
export function iniciarReconocimiento(recognition: any): void {
  if (!recognition) return;
  try {
    recognition.start();
  } catch {
    // Ya estaba escuchando: no hay nada que corregir.
  }
}

/** Traduce los codigos de error a algo que una persona pueda entender. */
export function describirErrorDeVoz(code: string): string | null {
  switch (code) {
    case 'no-speech':
    case 'aborted':
    case 'network':
      // Transitorios: el reinicio automatico los resuelve solo.
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'BiVi necesita permiso para usar el micrófono. Buscá el candado en la barra de direcciones y permití el micrófono.';
    case 'audio-capture':
      return 'No encontramos el micrófono. Revisá que esté conectado y que ninguna otra app lo esté usando.';
    default:
      return 'Hubo un problema escuchando. Tocá el botón para intentar de nuevo.';
  }
}

/**
 * Pide el microfono antes de arrancar. Sin esto, el rechazo del permiso llegaba
 * como un codigo tecnico en medio de la conversacion; asi se explica al toque y
 * en castellano.
 */
export async function pedirMicrofono(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new SpeechError('Este navegador no permite usar el micrófono. Probá con Chrome.');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Se libera enseguida: quien graba es el reconocimiento, no nosotros.
    stream.getTracks().forEach((track) => track.stop());
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new SpeechError(
        'Necesitamos permiso para usar el micrófono. Cuando el navegador lo pregunte, tocá "Permitir".'
      );
    }
    if (name === 'NotFoundError') {
      throw new SpeechError('No encontramos ningún micrófono en este dispositivo.');
    }
    throw new SpeechError('No pudimos acceder al micrófono. Probá cerrar otras apps que lo estén usando.');
  }
}
