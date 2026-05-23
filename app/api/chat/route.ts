import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { userMessage, history, systemPrompt } = await request.json();

    if (!userMessage || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing userMessage or systemPrompt' },
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat error' },
      { status: 500 }
    );
  }
}
