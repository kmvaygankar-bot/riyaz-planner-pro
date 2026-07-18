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

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  filter.Q.value = 0.9;
  filter.connect(out);

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
        oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
        try { lfo.stop(); } catch { /* noop */ }
        out.disconnect();
      }, 700);
    },
    setVolume(v) {
      out.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.08);
    },
  };
}

// ============================================================
// Scale-degree token parser + note sequence player (for lessons)
// ============================================================

// Semitone offsets from Sa. Uppercase = shuddha, lowercase = komal.
// Unicode dot-above characters shift up an octave. Backtick prefix shifts down.
const DEGREE: Record<string, number> = {
  S: 0, R: 2, G: 4, M: 5, P: 7, D: 9, N: 11,
  r: 1, g: 3, m: 6, d: 8, n: 10, // komal (m as tivra Ma for convenience)
  "Ṡ": 12, "Ṙ": 14, "Ġ": 16, "Ṁ": 17, "Ṗ": 19, "Ḋ": 21, "Ṅ": 23,
};

export interface SeqToken {
  semis: number;    // semitone offset from Sa
  glideTo?: number; // if defined, glide from `semis` to `glideTo` across the beat
  rest?: boolean;
}

/** Parse a pattern like "SRGM RGMP" or "S~R R~G" into tokens. */
export function parseSargam(pattern: string): SeqToken[] {
  const tokens: SeqToken[] = [];
  const chars = Array.from(pattern);
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c === " " || c === "\t" || c === "\n" || c === "|" || c === ",") {
      // phrase separator → short rest
      if (tokens.length && !tokens[tokens.length - 1].rest) tokens.push({ semis: 0, rest: true });
      i++;
      continue;
    }
    if (c in DEGREE) {
      const semis = DEGREE[c];
      // check for glide "~"
      if (chars[i + 1] === "~" && chars[i + 2] in DEGREE) {
        tokens.push({ semis, glideTo: DEGREE[chars[i + 2]] });
        i += 3;
        continue;
      }
      tokens.push({ semis });
      i++;
      continue;
    }
    // unknown char, skip
    i++;
  }
  // strip trailing rest
  while (tokens.length && tokens[tokens.length - 1].rest) tokens.pop();
  return tokens;
}

/** Reverse a token list to build avroh from aaroh (glides reverse too). */
export function reverseTokens(tokens: SeqToken[]): SeqToken[] {
  const rev = tokens.slice().reverse();
  return rev.map((t) => {
    if (t.rest) return t;
    if (t.glideTo !== undefined) return { semis: t.glideTo, glideTo: t.semis };
    return { semis: t.semis };
  });
}

export interface SequenceHandle {
  stop: () => void;
  setVolume: (v: number) => void;
  onStep: (cb: (idx: number, token: SeqToken | null) => void) => void;
}

/**
 * Play a sargam sequence on the harmonium reed voicing.
 * Adds a soft Sa drone underneath so pitch reference stays constant.
 */
export function startHarmoniumSequence(opts: {
  sa: string;
  tokens: SeqToken[];
  bpm: number;
  loop?: boolean;
  volume?: number;
  drone?: boolean;
}): SequenceHandle {
  const { ctx, master } = getAudio();
  void ensureRunning();

  const volume = opts.volume ?? 0.55;
  const beatSec = 60 / opts.bpm;
  const saFreq = noteToFreq(opts.sa, 4);
  const tokens = opts.tokens.length ? opts.tokens : parseSargam("S R G M P D N Ṡ");

  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(master);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.8;
  filter.connect(out);

  // Optional soft Sa drone
  const droneNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = opts.drone === false
    ? null
    : (() => {
        const g = ctx.createGain();
        g.gain.value = 0.14;
        g.connect(filter);
        const oscs: OscillatorNode[] = [];
        [-12, 0].forEach((semi) => {
          const f = saFreq * Math.pow(2, semi / 12);
          [-6, 0, 6].forEach((det, i) => {
            const o = ctx.createOscillator();
            o.type = i === 1 ? "triangle" : "sawtooth";
            o.frequency.value = f;
            o.detune.value = det;
            o.connect(g);
            o.start();
            oscs.push(o);
          });
        });
        return { oscs, gain: g };
      })();

  let stopped = false;
  let idx = 0;
  let nextTime = ctx.currentTime + 0.1;
  let listener: ((i: number, t: SeqToken | null) => void) | null = null;
  const activeOscs: OscillatorNode[] = [];

  function playToken(token: SeqToken, when: number, dur: number) {
    if (token.rest) return;
    const startF = saFreq * Math.pow(2, token.semis / 12);
    const endF = token.glideTo !== undefined ? saFreq * Math.pow(2, token.glideTo / 12) : startF;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.32, when + 0.03);
    g.gain.setValueAtTime(0.32, when + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.98);
    g.connect(filter);

    // reed = detuned saw + triangle + saw
    const detunes = [-8, 0, 8];
    const types: OscillatorType[] = ["sawtooth", "triangle", "sawtooth"];
    detunes.forEach((det, i) => {
      const o = ctx.createOscillator();
      o.type = types[i];
      o.detune.value = det;
      o.frequency.setValueAtTime(startF, when);
      if (endF !== startF) {
        o.frequency.linearRampToValueAtTime(endF, when + dur * 0.9);
      }
      o.connect(g);
      o.start(when);
      o.stop(when + dur + 0.05);
      activeOscs.push(o);
    });
  }

  const timer = setInterval(() => {
    if (stopped) return;
    while (nextTime < ctx.currentTime + 0.2) {
      if (idx >= tokens.length) {
        if (opts.loop) {
          idx = 0;
          nextTime += beatSec; // gap between loops
          continue;
        } else {
          stopped = true;
          break;
        }
      }
      const t = tokens[idx];
      playToken(t, nextTime, beatSec);
      const when = nextTime;
      const delay = Math.max(0, (when - ctx.currentTime) * 1000);
      const currentIdx = idx;
      setTimeout(() => listener?.(currentIdx, t), delay);
      nextTime += beatSec;
      idx++;
    }
  }, 30);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      setTimeout(() => {
        activeOscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
        droneNodes?.oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
        out.disconnect();
      }, 400);
    },
    setVolume(v) {
      out.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.08);
    },
    onStep(cb) { listener = cb; },
  };
}
