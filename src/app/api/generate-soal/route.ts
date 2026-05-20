import { NextRequest, NextResponse } from 'next/server';
import { generateQuestions } from '@/lib/gemini';
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
