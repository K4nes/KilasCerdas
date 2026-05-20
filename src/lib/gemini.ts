import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Question } from "./room-manager";
import { getFallbackQuestions } from "./utils";

const API_KEY = process.env.GEMINI_API_KEY || "";

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

function parseJSONFromMarkdown(text: string): any {
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

export async function generateQuestions(
  topic: string,
  count: number,
): Promise<Question[]> {
  if (!API_KEY || !genAI) {
    console.warn("No Gemini API key configured, using fallback questions");
    return getFallbackQuestions(topic, count);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `Kamu adalah generator soal kuis. Buatkan ${count} soal pilihan ganda tentang "${topic}".

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
- Response HARUS JSON array VALID, tanpa markdown formatting`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const parsed = parseJSONFromMarkdown(text);

    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      const questions = parsed.map((q: any, i: number) => ({
        question: q.question || `Question ${i + 1}`,
        options: Array.isArray(q.options)
          ? q.options
          : ["A. -", "B. -", "C. -", "D. -"],
        correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
      }));
      return questions.slice(0, count);
    }

    throw new Error("Invalid response format from Gemini");
  } catch (error) {
    console.error("Gemini API error:", error);
    return getFallbackQuestions(topic, count);
  }
}
