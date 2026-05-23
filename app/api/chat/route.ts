import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'API key de Gemini no configurada en el servidor' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const { userMessage, history, systemPrompt } = await request.json();

    if (!userMessage || !systemPrompt) {
      return NextResponse.json(
        { error: 'Faltan datos en la solicitud' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const conversationHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    conversationHistory.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const response = await model.generateContent({
      contents: conversationHistory,
      systemInstruction: systemPrompt,
    });

    const reply = response.response.text();

    return NextResponse.json({
      reply,
      history: [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: reply },
      ],
    });
  } catch (error) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
