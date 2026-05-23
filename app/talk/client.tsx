'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { buildSystemPrompt } from '@/lib/systemPrompt';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Elder {
  full_name: string;
  age: number;
  favorite_topics: string[];
}

export default function TalkClient() {
  const router = useRouter();
  const [elder, setElder] = useState<Elder | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('bivi_elder');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [state, setState] = useState<State>('idle');
  const [history, setHistory] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const stateRef = useRef<State>('idle');
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUserMessageRef = useRef<(text: string) => void>(() => {});

  // Fallback: load from localStorage after hydration
  useEffect(() => {
    if (!elder) {
      const stored = localStorage.getItem('bivi_elder');
      if (stored) {
        try {
          setElder(JSON.parse(stored));
        } catch (e) {
          setError('Error cargando datos del adulto mayor');
        }
      }
    }
  }, []);

  const systemPrompt = elder ? buildSystemPrompt(elder.full_name, elder.age, elder.favorite_topics) : '';

  // Keep refs in sync so closures always read the latest values
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(''), 5000);
  };

  // Init speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Tu navegador no soporta reconocimiento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognitionRef.current = recognition;
  }, []);

  // Request mic permission and start session
  const startSession = useCallback(async () => {
    if (state !== 'idle' || !elder) return;

    try {
      setState('speaking');

      // Greeting
      const greeting = `Hola ${elder.full_name}, ¿cómo andás hoy?`;
      await speakText(greeting);

      // Start listening
      setState('listening');
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error iniciando sesión');
    }
  }, [elder, state]);

  const speakText = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.9;

      // Get voices with a small delay to ensure they're loaded
      const setVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // First try to find es-ES voice, then any Spanish voice
          let spanishVoice = voices.find((v) => v.lang.startsWith('es-ES'));
          if (!spanishVoice) {
            spanishVoice = voices.find((v) => v.lang.startsWith('es'));
          }
          // Fall back to any voice with 'spanish' in the name
          if (!spanishVoice) {
            spanishVoice = voices.find((v) => v.name.toLowerCase().includes('spanish'));
          }
          if (spanishVoice) {
            utterance.voice = spanishVoice;
          }
        }
      };

      setVoice();
      utteranceRef.current = utterance;
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  };

  const endSession = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();

      setState('idle');
      setHistory([]);
    } catch (err) {
      console.error('End session error:', err);
    }
  }, []);

  // Speech recognition event handlers
  useEffect(() => {
    if (!recognitionRef.current) return;

    let finalTranscript = '';

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        handleUserMessageRef.current(finalTranscript.trim());
        finalTranscript = '';
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      // Errors that are safe to ignore — recognition will restart via onend
      const silentErrors = ['no-speech', 'aborted', 'network'];
      if (!silentErrors.includes(event.error)) {
        showError(`Error de reconocimiento: ${event.error}`);
      }
    };

    recognitionRef.current.onend = () => {
      if (stateRef.current === 'listening') {
        // Small delay avoids rapid restart loops on network errors
        setTimeout(() => recognitionRef.current?.start(), 300);
      }
    };
  }, [state]);

  const handleUserMessage = useCallback(
    async (userText: string) => {
      if (state !== 'listening') return;

      try {
        setState('thinking');
        recognitionRef.current?.stop();

        const newHistory = [...history, { role: 'user' as const, content: userText }];
        setHistory(newHistory);

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage: userText,
            history,
            systemPrompt,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Error al conectar con BiVi');
        }
        const { reply, history: updatedHistory } = await response.json();
        setHistory(updatedHistory);

        setState('speaking');
        await speakText(reply);

        // Resume listening
        setState('listening');
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Error al conectar con BiVi');
        setState('idle');
      }
    },
    [state, history, systemPrompt]
  );

  // Keep ref in sync — onresult closure always calls the latest version
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

  if (!elder) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <p className="text-gray-600">Cargando datos del adulto mayor...</p>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard')}
        className="fixed top-4 left-4 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-semibold transition"
      >
        ← Volver
      </button>

      {/* Main button */}
      <div className="flex flex-col items-center justify-center flex-1 w-full">
        <button
          onClick={state === 'idle' ? startSession : undefined}
          disabled={state !== 'idle'}
          className={`w-64 h-64 rounded-full flex items-center justify-center text-white font-bold text-2xl transition-all ${
            state === 'idle'
              ? 'bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer'
              : state === 'listening'
                ? 'bg-green-500 animate-pulse'
                : state === 'thinking'
                  ? 'bg-yellow-500'
                  : 'bg-indigo-600'
          }`}
        >
          <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 16.91c-1.48.88-3.18 1.4-5 1.4s-3.52-.52-5-1.41V20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-3.09z" />
          </svg>
        </button>

        <p className="mt-6 text-lg font-semibold text-blue-900">{getStatusText()}</p>
      </div>

      {/* End button */}
      {state !== 'idle' && (
        <button
          onClick={endSession}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-semibold text-lg transition"
        >
          Terminar
        </button>
      )}

      {error && (
        <div className="fixed top-16 left-4 right-4 bg-red-100 text-red-800 p-3 rounded-lg flex items-start gap-2">
          <span className="flex-1 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-600 font-bold text-lg leading-none shrink-0">×</button>
        </div>
      )}
    </main>
  );
}
