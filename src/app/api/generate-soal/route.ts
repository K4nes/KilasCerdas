import { NextRequest, NextResponse } from 'next/server';
import { generateQuestions, GeminiRateLimitError, GeminiNoKeyError, GeminiGenerateError } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = body.topic || 'Umum';
    const count = Math.min(Math.max(parseInt(body.questionCount) || 5, 3), 15);
    const chatId = typeof body.chatId === 'string' ? body.chatId : undefined;

    const { questions, chatId: effectiveChatId } = await generateQuestions(topic, count, chatId);

    return NextResponse.json({ success: true, questions, chatId: effectiveChatId });
  } catch (error) {
    if (error instanceof GeminiRateLimitError) {
      return NextResponse.json(
        {
          success: false,
          error: 'rate_limit',
          retryAfterSec: error.retryAfterSec,
          message: 'Kuota generate soal harian sudah habis. Coba lagi sebentar.',
        },
        { status: 429 },
      );
    }
    if (error instanceof GeminiNoKeyError) {
      return NextResponse.json(
        { success: false, error: 'no_key', message: 'Gemini API key tidak dikonfigurasi di server.' },
        { status: 500 },
      );
    }
    if (error instanceof GeminiGenerateError) {
      return NextResponse.json(
        { success: false, error: 'generate_failed', message: error.message },
        { status: 500 },
      );
    }
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { success: false, error: 'unknown', message: 'Gagal generate soal' },
      { status: 500 },
    );
  }
}
