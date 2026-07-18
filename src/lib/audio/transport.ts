// Shared AudioContext for tanpura, tala and tuner so they mix into one output.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function getAudio(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    const AC =
      (typeof window !== "undefined" &&
        ((window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext)) ||
      null;
    if (!AC) throw new Error("Web Audio not supported");
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  return { ctx: ctx!, master: master! };
}

export async function ensureRunning() {
  const { ctx } = getAudio();
  if (ctx.state === "suspended") await ctx.resume();
}

// Convert note name + octave (C4=middle C ≈ 261.63Hz) to frequency
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function noteToFreq(note: string, octave = 4): number {
  const idx = NOTES.indexOf(note);
  const semitones = idx - 9 + (octave - 4) * 12; // A4 = 440
  return 440 * Math.pow(2, semitones / 12);
}
export const NOTE_NAMES = NOTES;

export function freqToNote(freq: number): { note: string; octave: number; cents: number } {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return { note: NOTES[noteIndex], octave, cents };
}
