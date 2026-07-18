// Client-side song analysis: decode audio, extract pitch histogram,
// detect scale degrees used, guess Sa, and build a compact pattern preview.

import { noteToFreq, NOTE_NAMES } from "./transport";

export interface AnalyzeProgress {
  phase: "decoding" | "analyzing" | "done";
  pct: number;
}

export interface AnalyzeResult {
  durationSec: number;
  sampleRate: number;
  voicedFrames: number;
  totalFrames: number;
  /** semitone histogram (0-11) - counts of frames landing on each pitch class */
  histogram: number[];
  /** scale degrees present, using tokens S r R g G m M P d D n N */
  notesUsed: string[];
  /** compact display sequence (list of degree tokens with rests as "|") */
  pattern: string[];
  /** suggested Sa (note name like "C") given user's chosen Sa */
  saSuggestion: string;
  /** raag hint if match is confident */
  raagHint: string | null;
  /** frame-level detected semitones relative to Sa, or null when unvoiced */
  frameSemis: (number | null)[];
  /** hop size in seconds between frames */
  hopSec: number;
}

const DEGREE_TOKENS = ["S", "r", "R", "g", "G", "m", "M", "P", "d", "D", "n", "N"] as const;

const RAAG_TABLE: { name: string; notes: string[] }[] = [
  { name: "Bilawal (major)", notes: ["S", "R", "G", "M", "P", "D", "N"] },
  { name: "Yaman", notes: ["S", "R", "G", "M", "P", "D", "N"] }, // tivra Ma actually (M here)
  { name: "Kafi", notes: ["S", "R", "g", "M", "P", "D", "n"] },
  { name: "Bhairav", notes: ["S", "r", "G", "M", "P", "d", "N"] },
  { name: "Bhairavi", notes: ["S", "r", "g", "M", "P", "d", "n"] },
  { name: "Khamaj", notes: ["S", "R", "G", "M", "P", "D", "n"] },
  { name: "Asavari", notes: ["S", "R", "g", "M", "P", "d", "n"] },
];

function semiToDegree(semi: number): string {
  return DEGREE_TOKENS[((semi % 12) + 12) % 12];
}

/** Auto-correlation pitch detection on a single frame. Returns freq or -1. */
function detectPitchFrame(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const thresh = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thresh) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thresh) { r2 = SIZE - i; break; }
  const trimmed = buf.subarray(r1, r2);
  const size = trimmed.length;
  if (size < 32) return -1;
  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let sum = 0;
    for (let j = 0; j < size - i; j++) sum += trimmed[j] * trimmed[j + i];
    c[i] = sum;
  }
  let d = 0;
  while (d < size - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < size; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  if (maxpos <= 0) return -1;
  let T0 = maxpos;
  const x1 = c[T0 - 1] ?? 0, x2 = c[T0], x3 = c[T0 + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);
  return sampleRate / T0;
}

/** Downmix an AudioBuffer to mono Float32Array. */
function toMono(ab: AudioBuffer): Float32Array {
  const len = ab.length;
  const out = new Float32Array(len);
  for (let ch = 0; ch < ab.numberOfChannels; ch++) {
    const data = ab.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  const g = 1 / Math.max(1, ab.numberOfChannels);
  for (let i = 0; i < len; i++) out[i] *= g;
  return out;
}

export async function analyzeSongFile(
  file: File,
  chosenSa: string,
  onProgress: (p: AnalyzeProgress) => void,
): Promise<AnalyzeResult> {
  onProgress({ phase: "decoding", pct: 5 });
  const AC =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error("Web Audio not supported in this browser");
  const decodeCtx = new AC();
  const buf = await file.arrayBuffer();
  const audio = await decodeCtx.decodeAudioData(buf);
  await decodeCtx.close();

  if (audio.duration > 180.5) {
    throw new Error(`Song is ${Math.round(audio.duration)}s — must be 3 minutes or less.`);
  }

  onProgress({ phase: "analyzing", pct: 20 });
  const mono = toMono(audio);
  const sr = audio.sampleRate;
  const frameSize = 2048;
  const hop = 1024;
  const totalFrames = Math.max(0, Math.floor((mono.length - frameSize) / hop));
  const hopSec = hop / sr;

  const saFreq = noteToFreq(chosenSa, 4);
  const histogram = new Array(12).fill(0);
  const frameSemis: (number | null)[] = new Array(totalFrames).fill(null);

  let voiced = 0;
  const chunkFrames = 64;
  const frameBuf = new Float32Array(frameSize);

  for (let start = 0; start < totalFrames; start += chunkFrames) {
    const end = Math.min(totalFrames, start + chunkFrames);
    for (let f = start; f < end; f++) {
      const off = f * hop;
      frameBuf.set(mono.subarray(off, off + frameSize));
      const freq = detectPitchFrame(frameBuf, sr);
      if (freq > 60 && freq < 1500) {
        const midi = 12 * Math.log2(freq / saFreq);
        const semi = Math.round(midi);
        const cents = Math.abs(midi - semi) * 100;
        if (cents < 40) {
          const mod = ((semi % 12) + 12) % 12;
          histogram[mod]++;
          frameSemis[f] = semi;
          voiced++;
        }
      }
    }
    const pct = 20 + Math.round((end / Math.max(1, totalFrames)) * 75);
    onProgress({ phase: "analyzing", pct });
    // yield to UI
    await new Promise((r) => setTimeout(r, 0));
  }

  // Notes used: >= 1.5% of voiced frames
  const thr = Math.max(2, Math.floor(voiced * 0.015));
  const notesUsed: string[] = [];
  histogram.forEach((count, semi) => {
    if (count >= thr) notesUsed.push(semiToDegree(semi));
  });

  // Compact pattern from frame-level detections (segment every ~200ms)
  const segFrames = Math.max(1, Math.round(0.2 / hopSec));
  const pattern: string[] = [];
  let lastTok: string | null = null;
  for (let f = 0; f < totalFrames; f += segFrames) {
    const votes: Record<number, number> = {};
    let voicedSeg = 0;
    for (let k = f; k < Math.min(totalFrames, f + segFrames); k++) {
      const s = frameSemis[k];
      if (s !== null) {
        const mod = ((s % 12) + 12) % 12;
        votes[mod] = (votes[mod] ?? 0) + 1;
        voicedSeg++;
      }
    }
    if (voicedSeg < segFrames * 0.4) {
      if (lastTok !== "|") { pattern.push("|"); lastTok = "|"; }
      continue;
    }
    let bestSemi = -1, bestVotes = 0;
    for (const [k, v] of Object.entries(votes)) {
      if (v > bestVotes) { bestVotes = v; bestSemi = Number(k); }
    }
    if (bestSemi < 0) continue;
    const tok = semiToDegree(bestSemi);
    if (tok !== lastTok) { pattern.push(tok); lastTok = tok; }
    if (pattern.length >= 48) break;
  }

  // Sa suggestion: peak histogram note → convert to absolute
  let peakSemi = 0, peakCount = 0;
  histogram.forEach((c, i) => { if (c > peakCount) { peakCount = c; peakSemi = i; } });
  const chosenIdx = NOTE_NAMES.indexOf(chosenSa);
  const suggestedIdx = ((chosenIdx + peakSemi) % 12 + 12) % 12;
  const saSuggestion = NOTE_NAMES[suggestedIdx];

  // Raag hint: best subset match
  const noteSet = new Set(notesUsed);
  let bestRaag: string | null = null;
  let bestScore = 0;
  for (const r of RAAG_TABLE) {
    const rset = new Set(r.notes);
    let overlap = 0;
    for (const n of noteSet) if (rset.has(n)) overlap++;
    let extra = 0;
    for (const n of noteSet) if (!rset.has(n)) extra++;
    const score = overlap - extra * 1.5;
    if (score > bestScore) { bestScore = score; bestRaag = r.name; }
  }
  const raagHint = bestScore >= 4 ? bestRaag : null;

  onProgress({ phase: "done", pct: 100 });

  return {
    durationSec: audio.duration,
    sampleRate: sr,
    voicedFrames: voiced,
    totalFrames,
    histogram,
    notesUsed,
    pattern,
    saSuggestion,
    raagHint,
    frameSemis,
    hopSec,
  };
}
