'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const STORAGE_KEY = 'kilascerdas_music_enabled';
const AUDIO_SRC = '/sounds/playful-lofi.wav';
const TARGET_VOLUME = 0.35;
const FADE_DURATION_S = 2.5;
const FADE_DURATION_MS = FADE_DURATION_S * 1000;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export default function MusicToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // User-intent multiplier (0..1), smoothly tweened on mute/unmute toggle.
  // Final volume = positionalVolume * userMult.
  const userMultRef = useRef(0);
  const userMultStartRef = useRef(0);
  const userMultTargetRef = useRef(0);
  const userMultStartTimeRef = useRef(0);
  const pauseAfterUserFadeRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);

  /**
   * Compute volume from track position:
   *   first 2.5s         → fade-in   (0 → TARGET)
   *   last 2.5s          → fade-out  (TARGET → 0)
   *   everywhere else    → TARGET
   * Combined with `loop = true`, this produces a seamless cross-fade
   * at the loop boundary (end of track ramps down, start ramps up).
   */
  const positionalVolume = (currentTime: number, duration: number): number => {
    if (!isFinite(duration) || duration <= 2 * FADE_DURATION_S) {
      return TARGET_VOLUME; // track too short or metadata not yet loaded
    }
    if (currentTime < FADE_DURATION_S) {
      return TARGET_VOLUME * easeOutCubic(currentTime / FADE_DURATION_S);
    }
    const fadeOutStart = duration - FADE_DURATION_S;
    if (currentTime > fadeOutStart) {
      return TARGET_VOLUME * easeOutCubic((duration - currentTime) / FADE_DURATION_S);
    }
    return TARGET_VOLUME;
  };

  /**
   * Begin (or retarget) the user-intent tween.
   * - target = 1 → user wants playback (fade up)
   * - target = 0 → user wants silence (fade down, then pause element)
   * Mid-flight calls retarget smoothly from the current multiplier.
   */
  const tweenUserIntent = (target: 0 | 1) => {
    userMultStartRef.current = userMultRef.current;
    userMultTargetRef.current = target;
    userMultStartTimeRef.current = performance.now();
    pauseAfterUserFadeRef.current = target === 0;
    ensureRaf();
  };

  const ensureRaf = () => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const tick = () => {
    const audio = audioRef.current;
    if (!audio) {
      rafRef.current = null;
      return;
    }

    // 1. Advance user-intent tween.
    const elapsed = performance.now() - userMultStartTimeRef.current;
    const t = Math.min(1, elapsed / FADE_DURATION_MS);
    userMultRef.current =
      userMultStartRef.current +
      (userMultTargetRef.current - userMultStartRef.current) * easeOutCubic(t);

    // 2. Compute positional curve from track time.
    const positional = positionalVolume(audio.currentTime, audio.duration);

    // 3. Final volume = product of both factors.
    audio.volume = clamp01(positional * userMultRef.current);

    // 4. After user fade-out completes, actually pause the element.
    if (t >= 1 && pauseAfterUserFadeRef.current && userMultRef.current < 0.001) {
      audio.pause();
      pauseAfterUserFadeRef.current = false;
      rafRef.current = null;
      return;
    }

    // 5. Continue ticking only while audio is playing OR a tween is active.
    if (!audio.paused || t < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  };

  const startPlayback = async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    audio.volume = 0; // start silent — positional + user tween will ramp up
    try {
      await audio.play();
      setIsPlaying(true);
      localStorage.setItem(STORAGE_KEY, 'on');
      tweenUserIntent(1);
      return true;
    } catch {
      return false; // autoplay blocked or playback rejected
    }
  };

  const stopPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(false);
    localStorage.setItem(STORAGE_KEY, 'off');

    // Instant mute — cancel any active tween, force volume to 0, pause now.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    userMultRef.current = 0;
    userMultStartRef.current = 0;
    userMultTargetRef.current = 0;
    pauseAfterUserFadeRef.current = false;
    audio.volume = 0;
    audio.pause();
  };

  // Mount: build audio element, attempt autoplay, fall back to first-interaction.
  useEffect(() => {
    setMounted(true);

    const audio = new Audio(AUDIO_SRC);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    audioRef.current = audio;

    const stored = localStorage.getItem(STORAGE_KEY);
    const shouldAutoplay = stored !== 'off'; // default ON for first-time visitors

    let detachInteractionListeners: (() => void) | null = null;

    if (shouldAutoplay) {
      void startPlayback().then((ok) => {
        if (ok) return;
        // Autoplay blocked — arm one-shot listener for first user gesture.
        const onFirstInteraction = () => { void startPlayback(); };
        const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
        events.forEach((evt) =>
          window.addEventListener(evt, onFirstInteraction, {
            once: true,
            capture: true,
            passive: true,
          }),
        );
        detachInteractionListeners = () => {
          events.forEach((evt) =>
            window.removeEventListener(evt, onFirstInteraction, { capture: true }),
          );
        };
      });
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      detachInteractionListeners?.();
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    if (isPlaying) stopPlayback();
    else void startPlayback();
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label={isPlaying ? 'Matikan musik latar' : 'Putar musik latar'}
      aria-pressed={isPlaying}
      className={`music-toggle ${isPlaying ? 'is-on' : 'is-off'}`}
      type="button"
    >
      <span className="music-toggle__waves" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>

      <span className="music-toggle__icon" aria-hidden="true">
        {isPlaying ? (
          <Volume2 className="w-5 h-5" strokeWidth={3} />
        ) : (
          <VolumeX className="w-5 h-5" strokeWidth={3} />
        )}
      </span>

      <span className="music-toggle__label">
        {isPlaying ? 'PLAYING' : 'MUTED'}
      </span>
    </button>
  );
}
