import { getAudio, noteToFreq, ensureRunning } from "./transport";

export type HarmoniumNoteSet = "sa" | "sa-pa" | "sa-ma" | "sa-pa-sa8";

// scale-degree → semitone offsets from Sa
const SETS: Record<HarmoniumNoteSet, number[]> = {
  sa: [-12, 0],
  "sa-pa": [-12, -5, 0, 7],
  "sa-ma": [-12, -7, 0, 5],
  "sa-pa-sa8": [-12, 0, 7, 12],
};

export interface HarmoniumHandle {
  stop: () => void;
  setVolume: (v: number) => void;
}

/**
 * Sustained shruti-box / harmonium reed drone.
 * Layers detuned saw+triangle voices per note, low-passed to give a reedy tone
 * with a slow tremolo, and a gentle fade in/out.
 */
export function startHarmonium(opts: {
  sa: string;
  set: HarmoniumNoteSet;
  volume: number;
}): HarmoniumHandle {
  const { ctx, master } = getAudio();
  void ensureRunning();

  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(master);

  // reed filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  filter.Q.value = 0.9;
  filter.connect(out);

  // slow tremolo for bellows-like breathing
  const tremolo = ctx.createGain();
  tremolo.gain.value = 1;
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 4.5;
  lfoDepth.gain.value = 0.04;
  lfo.connect(lfoDepth).connect(tremolo.gain);
  lfo.start();
  tremolo.connect(filter);

  const saFreq = noteToFreq(opts.sa, 4);
  const offsets = SETS[opts.set];
  const oscs: OscillatorNode[] = [];

  offsets.forEach((semi) => {
    const f = saFreq * Math.pow(2, semi / 12);
    // three detuned oscillators per note = chorus / reed shimmer
    const detunes = [-6, 0, 6];
    const types: OscillatorType[] = ["sawtooth", "triangle", "sawtooth"];
    const g = ctx.createGain();
    g.gain.value = semi === 0 ? 0.22 : 0.14;
    g.connect(tremolo);
    detunes.forEach((d, i) => {
      const o = ctx.createOscillator();
      o.type = types[i];
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(g);
      o.start();
      oscs.push(o);
    });
  });

  // fade in
  const t0 = ctx.currentTime;
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(Math.max(0.001, opts.volume), t0 + 0.6);

  return {
    stop() {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      setTimeout(() => {
        oscs.forEach((o) => {
          try { o.stop(); } catch { /* noop */ }
        });
        try { lfo.stop(); } catch { /* noop */ }
        out.disconnect();
      }, 700);
    },
    setVolume(v) {
      out.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.08);
    },
  };
}
