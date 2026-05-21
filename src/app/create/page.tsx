'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, BookOpen, Trophy, HelpCircle } from 'lucide-react';
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
    <main className="min-h-screen flex flex-col justify-between bg-paper relative overflow-hidden">
      {/* Background soft blurs */}
      <div className="absolute inset-0 pointer-events-none opacity-30 z-0">
        <div className="absolute top-[10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-mint blur-[120px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-purple blur-[120px]" />
      </div>

      {/* ── N5 Pill Header ── */}
      <header className="px-6 pt-4 flex justify-between items-center z-10 w-full max-w-6xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="btn-secondary !rounded-xl !px-4 !py-2 border-2 border-rule bg-white flex items-center gap-2 shadow-sm font-bold text-xs tracking-wide uppercase hover:-translate-y-0.5 active:scale-95 transition-transform"
          aria-label="Kembali ke beranda"
        >
          <ArrowLeft className="w-4 h-4 text-ink" strokeWidth={2.5} />
          Kembali
        </button>

        <div className="nav-pill border-2 border-rule shadow-sm bg-white py-1.5 px-3 flex items-center gap-2">
          <span className="font-display text-xs font-black text-ink tracking-wide">
            KILAS CERDAS
          </span>
        </div>
      </header>

      {/* ── Workbench Grid Layout ── */}
      <section className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 md:py-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-start z-10">
        
        {/* Left Column: Workbench Explanation & Guidelines */}
        <div className="md:col-span-5 space-y-6 flex flex-col items-center md:items-start text-center md:text-left">
          <div className="sticker-bubble border-2 border-rule animate-bounce-in flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent-violet animate-pulse" />
            <span>AI Room Generator</span>
          </div>

          <h1 className="font-display text-[clamp(2.25rem,6vw,3.5rem)] font-black text-ink tracking-tight leading-[1.05] max-w-md">
            Topik bebas, Soal instan.
          </h1>

          <p className="text-ink font-semibold text-base max-w-md leading-relaxed">
            Tulis topik apa saja—mulai dari sejarah, pop culture, hingga sains—Gemini AI akan meracik kuis unik untuk kamu dan temanmu.
          </p>

          {/* Interactive tactile instruction list */}
          <div className="w-full space-y-3 pt-2 text-left">
            <div className="card card-purple border-2 border-rule shadow-xs p-4 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white border border-rule flex items-center justify-center font-bold text-xs shrink-0 text-on-purple">1</div>
              <div>
                <h3 className="text-xs font-black text-on-purple uppercase">Tulis Topik Kuis</h3>
                <p className="text-xs text-on-purple/80 font-bold leading-normal mt-3">Ketik bebas topik yang ingin kamu jadikan arena pertarungan.</p>
              </div>
            </div>

            <div className="card card-mint border-2 border-rule shadow-xs p-4 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white border border-rule flex items-center justify-center font-bold text-xs shrink-0 text-on-mint">2</div>
              <div>
                <h3 className="text-xs font-black text-on-mint uppercase">Tentukan Jumlah Soal</h3>
                <p className="text-xs text-on-mint/80 font-bold leading-normal mt-0.5">Pilih 5, 10, atau 15 soal untuk durasi duel yang ideal.</p>
              </div>
            </div>

            <div className="card card-pink border-2 border-rule shadow-xs p-4 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white border border-rule flex items-center justify-center font-bold text-xs shrink-0 text-on-pink">3</div>
              <div>
                <h3 className="text-xs font-black text-on-pink uppercase">Bagikan Kode Room</h3>
                <p className="text-xs text-on-pink/80 font-bold leading-normal mt-0.5">Kirim kode unik ke temanmu dan duel 1v1 siap dimulai!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Topic Picker Form */}
        <div className="md:col-span-7 flex justify-center w-full">
          <div className="card w-full border-3 border-ink shadow-lg bg-white p-6 md:p-8 space-y-6 relative animate-scale-in">
            {/* Tag label top right */}
            <div className="absolute -top-3 right-6 badge bg-card-amber text-on-amber border-2 border-rule font-black uppercase text-[10px] tracking-widest px-3 py-1">
              🛠️ CONFIGURE ROOM
            </div>

            <TopicPicker
              submitLabel="Generate Soal & Buat Room"
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="w-full max-w-6xl mx-auto px-6 pb-6 pt-2 z-10 border-t border-rule/60 flex flex-col sm:flex-row items-center justify-between text-muted text-[10px] font-bold tracking-wider uppercase gap-2">
        <span>© 2026 KILAS CERDAS</span>
      </footer>

      {/*
        Hallmark · macrostructure: Workbench Layout · tone: playful
        theme: studied-DNA (spec-locked pastel) · genre: playful
        contrast: pass (46–50) · H1 hero size: l (≤ 7 words)
        nav: N5 floating-pill · footer: Ft8 minimal
      */}
    </main>
  );
}
