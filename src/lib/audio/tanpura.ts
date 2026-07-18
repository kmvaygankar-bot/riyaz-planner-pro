import { getAudio, noteToFreq, ensureRunning } from "./transport";

export type TanpuraPattern = "pa-sa" | "ma-sa" | "ni-sa" | "sa-sa";

const PATTERNS: Record<TanpuraPattern, string[]> = {
  "pa-sa": ["P", "S", "S", "S_lo"],
  "ma-sa": ["M", "S", "S", "S_lo"],
  "ni-sa": ["N", "S", "S", "S_lo"],
  "sa-sa": ["S", "S", "S", "S_lo"],
};

// scale-degree → semitone offsets from Sa (P=7, M=5, N=11)
const OFFSETS: Record<string, number> = { S: 0, P: -5, M: -7, N: 1, S_lo: -12 };

interface Handle {
  stop: () => void;
  setVolume: (v: number) => void;
  setSpeed: (bpm: number) => void;
}

export function startTanpura(opts: {
  sa: string; // e.g. "C"
  octave?: number;
  pattern: TanpuraPattern;
  bpm: number; // strings per minute
  volume: number; // 0..1
}): Handle {
  const { ctx, master } = getAudio();
  void ensureRunning();

  const gain = ctx.createGain();
  gain.gain.value = opts.volume;
  gain.connect(master);

  let stopped = false;
  let interval = 60 / opts.bpm;
  const steps = PATTERNS[opts.pattern];

  const saFreq = noteToFreq(opts.sa, opts.octave ?? 3);
  const scheduleAheadTime = 0.15;
  let nextTime = ctx.currentTime + 0.05;
  let stepIdx = 0;

  function pluck(freq: number, when: number) {
    // additive: fundamental + a few partials, with plucked amp envelope
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.9, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 3.2);
    g.connect(gain);
    const partials = [1, 2, 3, 4, 5];
    const amps = [1, 0.55, 0.35, 0.22, 0.12];
    partials.forEach((p, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = freq * p;
      const pg = ctx.createGain();
      pg.gain.value = amps[i];
      o.connect(pg).connect(g);
      o.start(when);
      o.stop(when + 3.4);
    });
  }

  const timer = setInterval(() => {
    if (stopped) return;
    while (nextTime < ctx.currentTime + scheduleAheadTime) {
      const step = steps[stepIdx % steps.length];
      const offset = OFFSETS[step] ?? 0;
      const freq = saFreq * Math.pow(2, offset / 12);
      pluck(freq, nextTime);
      nextTime += interval;
      stepIdx++;
    }
  }, 40);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      setTimeout(() => gain.disconnect(), 900);
    },
    setVolume(v) {
      gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    },
    setSpeed(bpm) {
      interval = 60 / bpm;
    },
  };
}
