import { getAudio, ensureRunning } from "./transport";

export interface TalaDef {
  id: string;
  name: string;
  tradition: "hindustani" | "carnatic";
  beats: number;
  // per-beat accent: 3=sam, 2=tali (strong), 1=normal, 0=khali (soft)
  pattern: number[];
}

export const TALAS: TalaDef[] = [
  { id: "teentaal", name: "Teentaal", tradition: "hindustani", beats: 16, pattern: [3,1,1,1, 2,1,1,1, 0,1,1,1, 2,1,1,1] },
  { id: "ektaal", name: "Ektaal", tradition: "hindustani", beats: 12, pattern: [3,1, 0,1, 2,1, 0,1, 2,1, 2,1] },
  { id: "jhaptaal", name: "Jhaptaal", tradition: "hindustani", beats: 10, pattern: [3,1, 2,1,1, 0,1, 2,1,1] },
  { id: "rupak", name: "Rupak", tradition: "hindustani", beats: 7, pattern: [0,1,1, 2,1, 2,1] },
  { id: "dadra", name: "Dadra", tradition: "hindustani", beats: 6, pattern: [3,1,1, 0,1,1] },
  { id: "kaharwa", name: "Kaharwa", tradition: "hindustani", beats: 8, pattern: [3,1,1,1, 0,1,1,1] },
  { id: "adi", name: "Adi", tradition: "carnatic", beats: 8, pattern: [3,1,1,1, 0,1, 0,1] },
  { id: "rupaka", name: "Rupaka (C)", tradition: "carnatic", beats: 3, pattern: [3, 0, 1] },
  { id: "misra-chapu", name: "Misra Chapu", tradition: "carnatic", beats: 7, pattern: [3,1, 0,1, 2,1,1] },
  { id: "khanda-chapu", name: "Khanda Chapu", tradition: "carnatic", beats: 5, pattern: [3,1, 0,1,1] },
];

export function getTala(id: string): TalaDef {
  return TALAS.find((t) => t.id === id) ?? TALAS[0];
}

export interface TalaHandle {
  stop: () => void;
  setBpm: (bpm: number) => void;
  onBeat: (cb: (beatIdx: number, accent: number) => void) => void;
}

export function startTala(opts: { tala: TalaDef; bpm: number; volume?: number }): TalaHandle {
  const { ctx, master } = getAudio();
  void ensureRunning();
  const gain = ctx.createGain();
  gain.gain.value = opts.volume ?? 0.7;
  gain.connect(master);

  let bpm = opts.bpm;
  let stopped = false;
  let beatIdx = 0;
  let nextTime = ctx.currentTime + 0.05;
  let listener: ((i: number, a: number) => void) | null = null;

  function click(accent: number, when: number) {
    // Different pitches for sam/tali/khali/normal
    const freq = accent === 3 ? 1400 : accent === 2 ? 1000 : accent === 0 ? 500 : 800;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.type = accent === 0 ? "sine" : "triangle";
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent === 3 ? 0.8 : 0.5, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    o.connect(g).connect(gain);
    o.start(when);
    o.stop(when + 0.12);
  }

  const timer = setInterval(() => {
    if (stopped) return;
    const interval = 60 / bpm;
    while (nextTime < ctx.currentTime + 0.15) {
      const local = beatIdx % opts.tala.beats;
      const accent = opts.tala.pattern[local];
      click(accent, nextTime);
      if (listener) {
        const t = nextTime;
        const delay = Math.max(0, (t - ctx.currentTime) * 1000);
        setTimeout(() => listener?.(local, accent), delay);
      }
      nextTime += interval;
      beatIdx++;
    }
  }, 25);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      setTimeout(() => gain.disconnect(), 200);
    },
    setBpm(v) { bpm = v; },
    onBeat(cb) { listener = cb; },
  };
}
