'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Brain } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import TopicPicker, { type GeneratedQuestion } from '@/components/topic-picker';

export default function CreatePage() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [, setPlayerId] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('kilascerdas_player_name');
    const pid = localStorage.getItem('kilascerdas_player_id');
    if (stored) setPlayerName(stored);
    else {
      const name = 'Player_' + Math.random().toString(36).substring(2, 6);
      setPlayerName(name);
      localStorage.setItem('kilascerdas_player_name', name);
    }
    if (pid) setPlayerId(pid);
    else {
      const newPid = 'player_' + Math.random().toString(36).substring(2, 10);
      setPlayerId(newPid);
      localStorage.setItem('kilascerdas_player_id', newPid);
    }
  }, []);

  const handleSubmit = (topic: string, questions: GeneratedQuestion[]) =>
    new Promise<void>((resolve, reject) => {
      const socket = getSocket();

      const timeoutId = setTimeout(() => {
        socket.off('room_created', onRoomCreated);
        reject(new Error('Timeout membuat room. Coba lagi.'));
      }, 10000);

      const onRoomCreated = (roomData: { roomId: string; playerId: string }) => {
        clearTimeout(timeoutId);
        socket.off('room_created', onRoomCreated);
        localStorage.setItem('kilascerdas_player_name', playerName);
        localStorage.setItem('kilascerdas_player_id', roomData.playerId);
        resolve();
        router.push(`/room/${roomData.roomId}`);
      };

      socket.on('room_created', onRoomCreated);
      socket.emit('create_room', {
        topic,
        questionCount: questions.length,
        questions,
        playerName,
      });
    });

  return (
    <main className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <header className="px-4 pt-6">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center border border-rule shadow-sm hover:border-accent-violet hover:-translate-y-0.5 transition-all"
            aria-label="Kembali ke beranda"
          >
            <ArrowLeft className="w-4 h-4 text-ink" />
          </button>
          <div className="nav-pill !shadow-sm">
            <span className="w-6 h-6 rounded-md bg-accent-gradient flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </span>
            <span className="font-display text-sm font-extrabold text-ink">Buat Room</span>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-10 space-y-8 w-full flex-1">

        {/* ── Heading ── */}
        <div className="animate-fade-in space-y-2">
          <span className="badge"><Sparkles className="w-3 h-3" /> Atur Duel</span>
          <h1 className="font-display text-3xl md:text-4xl font-black text-ink tracking-tight leading-tight">
            Topik kamu, soal kami.
          </h1>
          <p className="text-muted text-sm md:text-base">
            Pilih topik dan jumlah soal — Gemini AI akan men-generate soal pilihan ganda yang segar.
          </p>
        </div>

        <TopicPicker
          submitLabel="Generate Soal & Buat Room"
          onSubmit={handleSubmit}
        />
      </div>

      {/*
        Hallmark · macrostructure: Workbench · genre: playful
        nav: N5 floating-pill back-button · footer: omitted (utility page)
        theme: Pastel locked-by-spec
        contrast: pass (46–50)
      */}
    </main>
  );
}
