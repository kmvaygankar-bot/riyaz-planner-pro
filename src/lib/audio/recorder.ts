// Mic-only recorder. Feed it a MediaStream containing ONLY the microphone
// so uploaded backing tracks don't get baked into the recording.

export interface RecordingResult {
  blob: Blob;
  url: string;
  mime: string;
  ext: string;
  durationSec: number;
}

export interface RecorderHandle {
  stop: () => Promise<RecordingResult>;
  cancel: () => void;
}

function pickMime(): { mime: string; ext: string } {
  const candidates: { mime: string; ext: string }[] = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  const MR = (typeof window !== "undefined"
    ? (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder
    : undefined);
  if (!MR) return { mime: "", ext: "webm" };
  for (const c of candidates) {
    try {
      if (MR.isTypeSupported && MR.isTypeSupported(c.mime)) return c;
    } catch {
      /* ignore */
    }
  }
  return { mime: "", ext: "webm" };
}

export function startRecording(stream: MediaStream): RecorderHandle {
  const { mime, ext } = pickMime();
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  rec.start(250);

  function finalize(): Promise<RecordingResult> {
    return new Promise((resolve) => {
      rec.onstop = () => {
        const outMime = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type: outMime });
        const url = URL.createObjectURL(blob);
        resolve({
          blob,
          url,
          mime: outMime,
          ext,
          durationSec: Math.round((Date.now() - startedAt) / 1000),
        });
      };
    });
  }

  return {
    stop: async () => {
      const p = finalize();
      if (rec.state !== "inactive") rec.stop();
      return p;
    },
    cancel: () => {
      try {
        if (rec.state !== "inactive") rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
