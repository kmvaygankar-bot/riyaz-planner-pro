// Simplified autocorrelation-based pitch detection (Web Audio only, no worklet).
import { getAudio, ensureRunning, freqToNote } from "./transport";

export interface PitchHandle {
  stop: () => void;
  onPitch: (cb: (freq: number | null, note: string | null, cents: number | null) => void) => void;
}

export async function startPitch(): Promise<PitchHandle> {
  const { ctx } = getAudio();
  await ensureRunning();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  let listener: ((f: number | null, n: string | null, c: number | null) => void) | null = null;

  function autoCorrelate(buf: Float32Array, sampleRate: number): number {
    const SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;
    let r1 = 0, r2 = SIZE - 1;
    const thresh = 0.2;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thresh) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thresh) { r2 = SIZE - i; break; }
    const trimmed = buf.slice(r1, r2);
    const size = trimmed.length;
    const c = new Array(size).fill(0);
    for (let i = 0; i < size; i++)
      for (let j = 0; j < size - i; j++) c[i] = c[i] + trimmed[j] * trimmed[j + i];
    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < size; i++) if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    let T0 = maxpos;
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
    return sampleRate / T0;
  }

  function tick() {
    analyser.getFloatTimeDomainData(buf);
    const f = autoCorrelate(buf, ctx.sampleRate);
    if (f > 40 && f < 2000) {
      const { note, cents } = freqToNote(f);
      listener?.(f, note, cents);
    } else {
      listener?.(null, null, null);
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
      src.disconnect();
    },
    onPitch(cb) { listener = cb; },
  };
}
