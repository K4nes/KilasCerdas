import { GoogleGenerativeAI, type ChatSession } from "@google/generative-ai";
import type { Question } from "./types";
import {
  GeminiRateLimitError,
  isRateLimitError,
} from "./gemini-error";

export { GeminiRateLimitError } from "./gemini-error";

const API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
];

const chatSessions = new Map<string, { chat: ChatSession; lastUsed: number }>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function parseJSONFromMarkdown(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {}
    }
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch {}
    }
    return null;
  }
}

function buildChatPrompt(topic: string, count: number, isNewChat: boolean): string {
  const continued = isNewChat ? "" : " (lanjutan dari sesi yang sama)";
  return `Kamu adalah generator soal kuis. Buatkan ${count} soal pilihan ganda tentang "${topic}"${continued}.

Format response HARUS JSON array:
[
  {
    "question": "teks pertanyaan",
    "options": ["A. opsi1", "B. opsi2", "C. opsi3", "D. opsi4"],
    "correctIndex": 0
  }
]

Aturan:
- correctIndex adalah index (0-3) dari jawaban benar di array options
- Options harus sudah include prefix "A.", "B.", "C.", "D."
- Jangan berikan soal yang ambigu
- Variasikan tingkat kesulitan
- Gunakan bahasa Indonesia
- Response HARUS JSON array VALID, tanpa markdown formatting
- JANGAN buat pertanyaan yang sama, serupa, atau duplikat secara konten/makna satu sama lain. Setiap soal harus unik, membahas aspek yang berbeda dari topik, dan tidak boleh mengulang informasi yang mirip dari soal lain dalam daftar ini ATAU dari soal yang pernah kamu buat sebelumnya di percakapan ini.`;
}

export class GeminiNoKeyError extends Error {
  constructor() {
    super("Gemini API key tidak dikonfigurasi");
    this.name = "GeminiNoKeyError";
  }
}

export class GeminiGenerateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiGenerateError";
  }
}

export async function generateQuestions(
  topic: string,
  count: number,
  chatId?: string,
): Promise<{ questions: Question[]; chatId: string }> {
  if (!API_KEY || !genAI) {
    throw new GeminiNoKeyError();
  }

  const now = Date.now();
  for (const [key, session] of chatSessions) {
    if (now - session.lastUsed > SESSION_TTL_MS) {
      chatSessions.delete(key);
    }
  }

  const effectiveChatId = chatId || "chat_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);

  const errors: string[] = [];

  for (const modelId of MODEL_FALLBACKS) {
    const sessionKey = `${modelId}:${effectiveChatId}`;
    let isNewChatForModel = true;

    let chat: ChatSession;
    if (chatSessions.has(sessionKey)) {
      const entry = chatSessions.get(sessionKey)!;
      entry.lastUsed = now;
      chat = entry.chat;
      isNewChatForModel = false;
    } else {
      const model = genAI.getGenerativeModel({ model: modelId });
      chat = model.startChat({ history: [] });
    }

    try {
      const prompt = buildChatPrompt(topic, count, isNewChatForModel);
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      const parsed = parseJSONFromMarkdown(text);

      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        throw new GeminiGenerateError("Format respons tidak valid dari model " + modelId);
      }

      const questions = parsed.map((q: { question?: string; options?: string[]; correctIndex?: number }, i: number) => ({
        question: q.question || `Question ${i + 1}`,
        options: Array.isArray(q.options) ? q.options : ["A. -", "B. -", "C. -", "D. -"],
        correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
      }));

      chatSessions.set(sessionKey, { chat, lastUsed: now });

      return { questions: questions.slice(0, count), chatId: effectiveChatId };
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn(`Rate limit on ${modelId}, trying next model...`);
        errors.push(`${modelId}: rate limit`);
        continue;
      }
      if (error instanceof GeminiNoKeyError) {
        throw error;
      }
      if (error instanceof GeminiGenerateError) {
        console.warn(`Generation error on ${modelId}: ${error.message}`);
        errors.push(`${modelId}: ${error.message}`);
        continue;
      }
      console.warn(`Unknown error on ${modelId}:`, error);
      errors.push(`${modelId}: ${(error as Error).message}`);
      continue;
    }
  }

  throw new GeminiGenerateError(`Semua model gagal: ${errors.join("; ")}`);
}
