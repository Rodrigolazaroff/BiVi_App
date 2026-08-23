'use client';

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { ElderProfile } from '@/lib/elder';
import { iniciarSesion, terminarSesion } from '@/lib/sessions';
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
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number>(0);

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

      // Se registra recien cuando el microfono ya esta concedido, para no
      // contar como conversacion un intento que nunca llego a arrancar.
      sessionStartRef.current = Date.now();
      sessionIdRef.current = await iniciarSesion(elder.id);

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
  }, [elder.full_name, elder.id, state, showError]);

  const endSession = useCallback(
    (status: 'completed' | 'error' = 'completed') => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Puede no estar escuchando; no importa.
      }
      window.speechSynthesis.cancel();

      terminarSesion(sessionIdRef.current, sessionStartRef.current, status);
      sessionIdRef.current = null;

      setState('idle');
      setHistory([]);
    },
    []
  );

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

        // El prompt lo arma el servidor con la ficha y los medicamentos: el
        // navegador no deberia poder decidir las instrucciones del modelo.
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userMessage: userText, history }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const mensaje = body.error || 'No pudimos conectarnos con BiVi.';

          // Pasarse de la cuota es una pausa, no una falla: se avisa y se sigue
          // escuchando, en vez de dar por terminada la conversacion.
          if (response.status === 429) {
            showError(mensaje);
            setState('listening');
            iniciarReconocimiento(recognitionRef.current);
            return;
          }

          throw new Error(mensaje);
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
        // Queda registrada como 'error' para distinguirla, en el seguimiento,
        // de una charla que la persona termino por su cuenta.
        endSession('error');
      }
    },
    [state, history, showError, endSession]
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

  /*
   * Cada estado tiene su color, pero el color NO es lo que lo comunica: el
   * texto de abajo (aria-live) lo dice con todas las letras. Para alguien que
   * no distingue bien los tonos, la pantalla sigue siendo legible.
   */
  const estilosDelBoton: Record<State, string> = {
    idle: 'bg-bivi-blue text-white hover:bg-bivi-blue-dark active:scale-[0.97] cursor-pointer',
    listening: 'bg-bivi-green text-white animate-pulse',
    thinking: 'border-4 border-bivi-blue bg-white text-bivi-blue',
    speaking: 'bg-bivi-blue-dark text-white',
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-bivi-bg p-4">
      <button
        onClick={() => router.push('/dashboard')}
        className="fixed top-4 left-4 rounded-xl border border-bivi-border bg-white px-4 py-2.5 font-bold text-bivi-text transition-[background-color,transform] duration-150 ease-out hover:bg-bivi-blue-soft active:scale-[0.97]"
      >
        ← Volver
      </button>

      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <button
          onClick={state === 'idle' ? startSession : undefined}
          disabled={state !== 'idle' || !soportado}
          aria-label={state === 'idle' ? 'Empezar a conversar con BiVi' : getStatusText()}
          className={`flex h-64 w-64 items-center justify-center rounded-full shadow-lift transition-transform duration-200 ease-out ${
            estilosDelBoton[state]
          } ${soportado ? '' : 'opacity-50'}`}
        >
          <svg className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 16.91c-1.48.88-3.18 1.4-5 1.4s-3.52-.52-5-1.41V20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-3.09z" />
          </svg>
        </button>

        <p
          className="mt-8 font-display text-2xl font-semibold tracking-tight text-bivi-text"
          aria-live="polite"
        >
          {getStatusText()}
        </p>
      </div>

      {state !== 'idle' && (
        <button
          /* Envuelto a proposito: pasar endSession directo le mandaria el
             evento del click como si fuera el estado de cierre. */
          onClick={() => endSession()}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-xl bg-bivi-alerta px-8 py-3.5 text-lg font-bold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-bivi-alerta-dark active:scale-[0.97]"
        >
          Terminar
        </button>
      )}

      {(error || errorDeSoporte) && (
        <div
          role="alert"
          className="fixed top-16 right-4 left-4 flex items-start gap-3 rounded-xl bg-bivi-alerta-soft p-4 font-bold text-bivi-alerta"
        >
          <span className="flex-1">{error || errorDeSoporte}</span>
          {/* El error de soporte no se puede cerrar: es una condicion del
              dispositivo, no un problema pasajero. */}
          {error && (
            <button
              onClick={() => setError('')}
              aria-label="Cerrar el aviso"
              className="shrink-0 text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>
      )}

      {aviso && !error && !errorDeSoporte && (
        <div className="fixed top-16 right-4 left-4 flex items-start gap-3 rounded-xl bg-bivi-aviso-soft p-4 text-bivi-aviso">
          <span className="flex-1">{aviso}</span>
          <button
            onClick={() => setAviso('')}
            aria-label="Cerrar el aviso"
            className="shrink-0 text-xl leading-none font-bold"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}
