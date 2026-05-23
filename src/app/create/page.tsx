'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { SERVER_ACK_TIMEOUT_MS } from '@/lib/game-config';
import { Events } from '@/lib/socket-events';
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
        socket.off(Events.ROOM_CREATED, onRoomCreated);
        reject(new Error('Timeout membuat room. Coba lagi.'));
      }, SERVER_ACK_TIMEOUT_MS);

      const onRoomCreated = (roomData: { roomId: string; playerId: string }) => {
        clearTimeout(timeoutId);
        socket.off(Events.ROOM_CREATED, onRoomCreated);
        localStorage.setItem('kilascerdas_player_name', playerName);
        localStorage.setItem('kilascerdas_player_id', roomData.playerId);
        resolve();
        router.push(`/room/${roomData.roomId}`);
      };

      socket.on(Events.ROOM_CREATED, onRoomCreated);
      socket.emit(Events.CREATE_ROOM, {
        topic,
        questionCount: questions.length,
        questions,
        playerName,
      });
    });

  return (
    <main className="min-h-screen flex flex-col justify-between bg-paper relative overflow-hidden">
      
      {/* Background blurs conform to Matcha Berry */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
        <div className="absolute top-[10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-mint blur-[120px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-card-purple blur-[120px]" />
      </div>

      {/* ── Header ── */}
      <header className="px-6 pt-6 flex justify-between items-center z-10 w-full max-w-6xl mx-auto">
        <button
          onClick={() => router.push('/')}
          className="btn-secondary !rounded-xl !px-4 !py-2 border-3 border-ink bg-white flex items-center gap-2 shadow-sm font-black text-xs tracking-wide uppercase hover:-translate-y-0.5 active:scale-95 transition-transform"
          aria-label="Kembali ke beranda"
        >
          <ArrowLeft className="w-4 h-4 text-ink" strokeWidth={3} />
          Kembali
        </button>

        <div className="nav-pill border-3 border-ink shadow-sm bg-white py-2 px-4 flex items-center gap-2">
          <span className="font-display text-sm font-black text-ink tracking-wide">
            KILAS CERDAS
          </span>
        </div>
      </header>

      {/* ── Workbench Grid Layout ── */}
      <section className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 md:py-16 grid grid-cols-1 md:grid-cols-12 gap-10 items-start z-10 relative">

        {/* Left Column: Workbench Explanation & Guidelines */}
        <div className="md:col-span-5 space-y-6 flex flex-col items-center md:items-start text-center md:text-left">
          
          <div className="sticker-bubble border-3 border-ink animate-bounce-in flex items-center gap-1.5 bg-card-purple text-on-purple py-1.5 px-3.5">
            <Sparkles className="w-4 h-4 text-ink animate-pulse" />
            <span className="font-black text-xs uppercase tracking-wider">AI Room Generator</span>
          </div>

          <h1 className="font-display text-[clamp(2.25rem,6vw,3.5rem)] font-black text-ink tracking-tight leading-[1.0] max-w-md">
            Topik bebas,<br />Soal instan.
          </h1>

          <p className="text-ink-body font-black text-base max-w-md leading-relaxed">
            Tulis topik apa saja—mulai dari sejarah, pop culture, hingga sains—Gemini AI akan meracik kuis unik untuk kamu dan temanmu.
          </p>

          {/* Interactive tactile instruction list */}
          <div className="w-full space-y-4 pt-4 text-left">
            <div className="card card-purple border-3 border-ink shadow-sm p-4 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white border-3 border-ink flex items-center justify-center font-black text-sm shrink-0 text-on-purple">1</div>
              <div>
                <h3 className="text-xs font-black text-on-purple uppercase">Tulis Topik Kuis</h3>
                <p className="text-xs text-on-purple/80 font-bold leading-normal mt-1">Ketik bebas topik kuis yang ingin kamu mainkan bersama.</p>
              </div>
            </div>

            <div className="card card-mint border-3 border-ink shadow-sm p-4 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white border-3 border-ink flex items-center justify-center font-black text-sm shrink-0 text-on-mint">2</div>
              <div>
                <h3 className="text-xs font-black text-on-mint uppercase">Tentukan Jumlah Soal</h3>
                <p className="text-xs text-on-mint/80 font-bold leading-normal mt-1">Pilih 5, 10, atau 15 soal untuk durasi kuis yang ideal.</p>
              </div>
            </div>

            <div className="card card-pink border-3 border-ink shadow-sm p-4 flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white border-3 border-ink flex items-center justify-center font-black text-sm shrink-0 text-on-pink">3</div>
              <div>
                <h3 className="text-xs font-black text-on-pink uppercase">Bagikan Kode Room</h3>
                <p className="text-xs text-on-pink/80 font-bold leading-normal mt-1">Kirim kode room ke temanmu dan duel 1v1 siap dimulai!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Topic Picker Form */}
        <div className="md:col-span-7 flex justify-center w-full relative">
          <div className="card w-full border-[3px] border-ink bg-white p-6 md:p-8 space-y-6 relative animate-scale-in">
            
            {/* Tag label top right */}
            <div className="absolute -top-3.5 right-6 badge bg-card-amber text-on-amber border-3 border-ink font-black uppercase text-[10px] tracking-widest px-3.5 py-1">
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
      <footer className="w-full max-w-6xl mx-auto px-6 pb-8 pt-4 z-10 border-t-3 border-ink flex flex-col sm:flex-row items-center justify-between text-ink-body text-xs font-black tracking-wider uppercase gap-2">
        <span>© 2026 KILAS CERDAS</span>
        <span className="flex items-center gap-1">
          Made with <Sparkles className="w-3.5 h-3.5 text-accent-pink fill-accent-pink" /> by Antigravity
        </span>
      </footer>

      {/*
        Hallmark · macrostructure: Workbench Layout · tone: playful
        theme: studied-DNA (Matcha Berry Spec-Locked) · genre: playful
        contrast: pass (46–50) · H1 hero size: l (≤ 7 words)
        nav: N5 floating-pill · footer: Ft8 minimal
      */}
    </main>
  );
}
