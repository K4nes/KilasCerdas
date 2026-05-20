export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generatePlayerId(): string {
  return 'player_' + Math.random().toString(36).substring(2, 10);
}

export function calculateScore(
  isCorrect: boolean,
  timeTakenMs: number,
  timeLimitMs: number
): number {
  if (!isCorrect) return 0;
  const base = 100;
  const timeRatio = Math.max(0, 1 - timeTakenMs / timeLimitMs);
  const speedBonus = Math.round(timeRatio * 100);
  return base + speedBonus;
}

export const SAMPLE_QUESTIONS: Record<string, { question: string; options: string[]; correctIndex: number }[]> = {
  'sains': [
    { question: 'Apa planet terbesar di tata surya?', options: ['A. Mars', 'B. Jupiter', 'C. Saturnus', 'D. Neptunus'], correctIndex: 1 },
    { question: 'Apa rumus kimia air?', options: ['A. CO2', 'B. NaCl', 'C. H2O', 'D. CH4'], correctIndex: 2 },
    { question: 'Berapa jumlah tulang pada tubuh manusia dewasa?', options: ['A. 106', 'B. 206', 'C. 306', 'D. 406'], correctIndex: 1 },
  ],
  'matematika': [
    { question: 'Berapa hasil dari 12 × 15?', options: ['A. 150', 'B. 170', 'C. 180', 'D. 200'], correctIndex: 2 },
    { question: 'Apa akar kuadrat dari 144?', options: ['A. 10', 'B. 11', 'C. 12', 'D. 13'], correctIndex: 2 },
    { question: 'Berapa luas lingkaran dengan jari-jari 7?', options: ['A. 144', 'B. 154', 'C. 164', 'D. 174'], correctIndex: 1 },
  ],
  'sejarah': [
    { question: 'Tahun berapa Indonesia merdeka?', options: ['A. 1942', 'B. 1945', 'C. 1948', 'D. 1950'], correctIndex: 1 },
    { question: 'Siapa presiden pertama Indonesia?', options: ['A. Soeharto', 'B. Soekarno', 'C. Hatta', 'D. Habibie'], correctIndex: 1 },
    { question: 'Peristiwa apa yang terjadi pada 10 November 1945?', options: ['A. Proklamasi', 'B. Sumpah Pemuda', 'C. Pertempuran Surabaya', 'D. Bandung Lautan Api'], correctIndex: 2 },
  ],
  'teknologi': [
    { question: 'Apa kepanjangan HTML?', options: ['A. HyperText Markup Language', 'B. High Tech Modern Language', 'C. Home Tool Markup Language', 'D. Hyper Transfer Markup Language'], correctIndex: 0 },
    { question: 'Siapa pendiri Microsoft?', options: ['A. Steve Jobs', 'B. Bill Gates', 'C. Mark Zuckerberg', 'D. Elon Musk'], correctIndex: 1 },
    { question: 'Apa itu CPU?', options: ['A. Central Processing Unit', 'B. Computer Personal Unit', 'C. Central Program Utility', 'D. Core Processing Unit'], correctIndex: 0 },
  ],
  'geografi': [
    { question: 'Apa gunung tertinggi di dunia?', options: ['A. Kilimanjaro', 'B. Everest', 'C. Merapi', 'D. Alpen'], correctIndex: 1 },
    { question: 'Berapa jumlah benua di dunia?', options: ['A. 5', 'B. 6', 'C. 7', 'D. 8'], correctIndex: 2 },
    { question: 'Apa sungai terpanjang di dunia?', options: ['A. Amazon', 'B. Nil', 'C. Mississippi', 'D. Yangtze'], correctIndex: 1 },
  ],
};

export function getFallbackQuestions(topic: string, count: number): { question: string; options: string[]; correctIndex: number }[] {
  const normalizedTopic = topic.toLowerCase().trim();
  const sampleKey = Object.keys(SAMPLE_QUESTIONS).find(k =>
    normalizedTopic.includes(k) || k.includes(normalizedTopic)
  );
  const pool = sampleKey ? SAMPLE_QUESTIONS[sampleKey] : SAMPLE_QUESTIONS['sains'];
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[i % pool.length]);
  }
  return result;
}
