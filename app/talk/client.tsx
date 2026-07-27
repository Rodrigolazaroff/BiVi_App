'use client';

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { buildSystemPrompt } from '@/lib/systemPrompt';
import type { ElderProfile } from '@/lib/elder';
import {
  SpeechError,
  crearReconocimiento,
  describirErrorDeVoz,
  getSpanishVoice,
  iniciarReconocimiento,
  isIOS,
  pedirMicrofono,
  soportaReconocimiento,
  speak,
} from '@/lib/speech';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function TalkClient({ elder }: { elder: ElderProfile }) {
  const router = useRouter();
  const [state, setState] = useState<State>('idle');
  const [history, setHistory] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const recognitionRef = useRef<any>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const stateRef = useRef<State>('idle');
  const handleUserMessageRef = useRef<(text: string) => void>(() => {});

  // La ficha llega desde el servidor, asi que el prompt esta listo de entrada.
  const systemPrompt = buildSystemPrompt(
    elder.full_name,
    elder.age,
    elder.favorite_topics
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /*
   * Si el navegador soporta reconocimiento es un dato fijo, no algo que cambie
   * con el tiempo. Se lee con useSyncExternalStore en vez de un efecto para que
   * el servidor asuma que si (y no mande HTML con un error que despues se
   * contradice al hidratar).
   */
  const soportado = useSyncExternalStore(
    () => () => {},
    () => soportaReconocimiento(),
    () => true
  );

  const errorDeSoporte = soportado
    ? ''
    : isIOS()
      ? 'En iPhone la conversación por voz todavía no funciona bien. Probá desde una computadora o un celular Android.'
      : 'Este navegador no puede escuchar. Probá con Google Chrome.';

  // Los errores ya no se autoborran: cinco segundos es poco para leer con calma,
  // sobre todo para el publico al que apunta BiVi. Se cierran a mano.
  const showError = useCallback((msg: string) => setError(msg), []);

  // Preparar voz y reconocimiento
  useEffect(() => {
    if (!soportaReconocimiento()) return;

    recognitionRef.current = crearReconocimiento();

    // Se resuelven las voces apenas se abre la pantalla, no al hablar: asi para
    // cuando BiVi tenga que decir algo la voz en espaniol ya esta elegida.
    let vigente = true;
    getSpanishVoice().then((voice) => {
      if (!vigente) return;
      voiceRef.current = voice;
      if (!voice) {
        setAviso('Este dispositivo no tiene una voz en español instalada, así que BiVi puede sonar distinto.');
      }
    });

    return () => {
      vigente = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        // Si nunca arranco, no hay nada que abortar.
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const startSession = useCallback(async () => {
    if (state !== 'idle') return;

    setError('');

    try {
      // El permiso se pide antes de arrancar para poder explicarlo en castellano.
      // Si se pidiera implicitamente al iniciar el reconocimiento, el rechazo
      // llegaria como un codigo tecnico en medio de la conversacion.
      await pedirMicrofono();

      setState('speaking');
      await speak(`Hola ${elder.full_name}, ¿cómo andás hoy?`, voiceRef.current);

      setState('listening');
      iniciarReconocimiento(recognitionRef.current);
    } catch (err) {
      showError(
        err instanceof SpeechError
          ? err.message
          : 'No pudimos empezar la conversación. Tocá el botón para intentar de nuevo.'
      );
      setState('idle');
    }
  }, [elder.full_name, state, showError]);

  const endSession = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Puede no estar escuchando; no importa.
    }
    window.speechSynthesis.cancel();
    setState('idle');
    setHistory([]);
  }, []);

  // Handlers del reconocimiento
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    let finalTranscript = '';

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }

      if (finalTranscript) {
        const text = finalTranscript.trim();
        finalTranscript = '';
        // En el celular el reconocimiento a veces cierra un resultado "final"
        // sin texto: detecta que alguien hablo pero no logra transcribir. Sin
        // este recorte previo llegaba una cadena vacia al API y se veia un error.
        if (text) handleUserMessageRef.current(text);
      }
    };

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    recognition.onerror = (event: any) => {
      const mensaje = describirErrorDeVoz(event.error);
      if (mensaje) showError(mensaje);
    };

    recognition.onend = () => {
      if (stateRef.current === 'listening') {
        // La pausa evita bucles de reinicio cuando la red se corta.
        setTimeout(() => iniciarReconocimiento(recognitionRef.current), 300);
      }
    };
  }, [showError]);

  const handleUserMessage = useCallback(
    async (userText: string) => {
      if (state !== 'listening') return;
      // Sin texto no hay nada que preguntarle al modelo.
      if (!userText.trim()) return;

      try {
        setState('thinking');
        recognitionRef.current?.stop();

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage: userText, history, systemPrompt }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'No pudimos conectarnos con BiVi.');
        }

        const { reply, history: updatedHistory } = await response.json();
        setHistory(updatedHistory);

        setState('speaking');
        await speak(reply, voiceRef.current);

        setState('listening');
        iniciarReconocimiento(recognitionRef.current);
      } catch (err) {
        showError(
          err instanceof Error && err.message
            ? err.message
            : 'Se cortó la conexión. Tocá el botón para seguir conversando.'
        );
        setState('idle');
      }
    },
    [state, history, systemPrompt, showError]
  );

  useEffect(() => {
    handleUserMessageRef.current = handleUserMessage;
  }, [handleUserMessage]);

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return 'Escuchando...';
      case 'thinking':
        return 'BiVi está pensando...';
      case 'speaking':
        return 'BiVi habla...';
      default:
        return '¿Conversamos?';
    }
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <button
        onClick={() => router.push('/dashboard')}
        className="fixed top-4 left-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition"
      >
        ← Volver
      </button>

      <div className="flex flex-col items-center justify-center flex-1 w-full">
        <button
          onClick={state === 'idle' ? startSession : undefined}
          disabled={state !== 'idle' || !soportado}
          aria-label={state === 'idle' ? 'Empezar a conversar con BiVi' : getStatusText()}
          className={`w-64 h-64 rounded-full flex items-center justify-center text-white font-bold text-2xl transition-all disabled:opacity-60 ${
            state === 'idle'
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer'
              : state === 'listening'
                ? 'bg-green-500 animate-pulse'
                : state === 'thinking'
                  ? 'bg-yellow-500'
                  : 'bg-indigo-600'
          }`}
        >
          <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 16.91c-1.48.88-3.18 1.4-5 1.4s-3.52-.52-5-1.41V20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-3.09z" />
          </svg>
        </button>

        <p className="mt-6 text-lg font-semibold text-blue-900" aria-live="polite">
          {getStatusText()}
        </p>
      </div>

      {state !== 'idle' && (
        <button
          onClick={endSession}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-semibold text-lg transition"
        >
          Terminar
        </button>
      )}

      {(error || errorDeSoporte) && (
        <div
          role="alert"
          className="fixed top-16 left-4 right-4 bg-red-100 text-red-900 p-4 rounded-lg flex items-start gap-3"
        >
          <span className="flex-1">{error || errorDeSoporte}</span>
          {/* El error de soporte no se puede cerrar: es una condicion del
              dispositivo, no un problema pasajero. */}
          {error && (
            <button
              onClick={() => setError('')}
              aria-label="Cerrar el aviso"
              className="text-red-700 font-bold text-xl leading-none shrink-0"
            >
              ×
            </button>
          )}
        </div>
      )}

      {aviso && !error && !errorDeSoporte && (
        <div className="fixed top-16 left-4 right-4 bg-amber-50 text-amber-900 p-4 rounded-lg flex items-start gap-3">
          <span className="flex-1">{aviso}</span>
          <button
            onClick={() => setAviso('')}
            aria-label="Cerrar el aviso"
            className="text-amber-700 font-bold text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}
