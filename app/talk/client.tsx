'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
  const [elder, setElder] = useState<Elder | null>(null);
  const [state, setState] = useState<State>('idle');
  const [history, setHistory] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load elder from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('bivi_elder');
    if (stored) {
      try {
        setElder(JSON.parse(stored));
      } catch (e) {
        setError('Error cargando datos del adulto mayor');
      }
    }
  }, []);

  const systemPrompt = elder ? buildSystemPrompt(elder.full_name, elder.age, elder.favorite_topics) : '';

  // Init speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Tu navegador no soporta reconocimiento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
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
      utterance.lang = 'es-AR';
      utterance.rate = 0.9;

      // Force Spanish voice
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(
        (v) => v.lang.includes('es') || v.name.toLowerCase().includes('spanish')
      );
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

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
        // Send to API
        handleUserMessage(finalTranscript.trim());
        finalTranscript = '';
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        setError(`Error de reconocimiento: ${event.error}`);
      }
    };

    recognitionRef.current.onend = () => {
      if (state === 'listening') {
        recognitionRef.current.start(); // Restart to keep listening
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

        if (!response.ok) throw new Error('Chat error');
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
        setError(err instanceof Error ? err.message : 'Chat error');
        setState('idle');
      }
    },
    [state, history, systemPrompt]
  );

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
        <div className="fixed top-4 left-4 right-4 bg-red-100 text-red-800 p-4 rounded-lg">
          {error}
        </div>
      )}
    </main>
  );
}
