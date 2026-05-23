import { NextRequest, NextResponse } from 'next/server';
import { generateQuestions, GeminiRateLimitError } from '@/lib/gemini';
import { getFallbackQuestions } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = body.topic || 'Umum';
    const count = Math.min(Math.max(parseInt(body.questionCount) || 5, 3), 15);

    let questions;
    try {
      questions = await generateQuestions(topic, count);
    } catch (err) {
      // Rate limits get a structured 429 so the client can show a dedicated
      // modal. Everything else falls back to the canned question set.
      if (err instanceof GeminiRateLimitError) {
        return NextResponse.json(
          {
            success: false,
            error: 'rate_limit',
            retryAfterSec: err.retryAfterSec,
            message:
              'Kuota generate soal harian sudah habis. Coba lagi sebentar.',
          },
          { status: 429 },
        );
      }
      console.error('Gemini generation failed, using fallback:', err);
      questions = getFallbackQuestions(topic, count);
    }

    return NextResponse.json({ success: true, questions, fromCache: false });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal generate soal' },
      { status: 500 }
    );
  }
}
