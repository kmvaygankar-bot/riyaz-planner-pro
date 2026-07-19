import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, Play, Square, Mic, Check, X, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { analyzeSongFile, type AnalyzeResult } from "@/lib/audio/analyze";
import { NOTE_NAMES, freqToNote, noteToFreq, getAudio, ensureRunning } from "@/lib/audio/transport";
import { startHarmoniumSequence, parseSargam, reverseTokens, type SequenceHandle, type SeqToken } from "@/lib/audio/harmonium";
import { startPitch, type PitchHandle } from "@/lib/audio/pitch";
import { startRecording, type RecorderHandle, type RecordingResult } from "@/lib/audio/recorder";
import { logPracticeSession } from "@/lib/practice.functions";
import { usePremium } from "@/lib/premium";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/studio")({
  head: () => ({ meta: [{ title: "Studio — Riyaz" }] }),
  component: StudioPage,
});

const DEGREE_ORDER = ["S", "r", "R", "g", "G", "m", "M", "P", "d", "D", "n", "N"];

interface RiyazReport {
  durationSec: number;
  accuracyPct: number;
  inTuneSec: number;
  hits: Record<string, number>;
  misses: string[];
  weakestNote: { note: string; avgCents: number } | null;
  targetNotes: string[];
}

function tsStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function StudioPage() {
  const log = useServerFn(logPracticeSession);
  const { isPremium } = usePremium();

  const [file, setFile] = useState<File | null>(null);
  const [sa, setSa] = useState("C");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [liveCents, setLiveCents] = useState<number | null>(null);
  const [expectedNote, setExpectedNote] = useState<string | null>(null);
  const [report, setReport] = useState<RiyazReport | null>(null);
  const [useGuide, setUseGuide] = useState(false);
  const [recording, setRecording] = useState<RecordingResult | null>(null);

  const seqRef = useRef<SequenceHandle | null>(null);
  const pitchRef = useRef<PitchHandle | null>(null);
  const recRef = useRef<RecorderHandle | null>(null);
  const songBufferRef = useRef<AudioBuffer | null>(null);
  const songSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const startedRef = useRef<number | null>(null);
  const statsRef = useRef({
    voicedFrames: 0,
    inTuneFrames: 0,
    frameMs: 50,
    hits: {} as Record<string, number>,
    centsSum: {} as Record<string, number>,
    centsN: {} as Record<string, number>,
  });
  const expectedRef = useRef<{ semis: number; degree: string } | null>(null);

  useEffect(() => () => {
    cleanupAll();
    if (recording?.url) URL.revokeObjectURL(recording.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      if (startedRef.current) setElapsed(Math.floor((Date.now() - startedRef.current) / 1000));
    }, 500);
    return () => clearInterval(iv);
  }, [playing]);

  function cleanupAll() {
    seqRef.current?.stop();
    pitchRef.current?.stop();
    try { songSrcRef.current?.stop(); } catch { /* ignore */ }
    try { songSrcRef.current?.disconnect(); } catch { /* ignore */ }
    recRef.current?.cancel();
    seqRef.current = null;
    pitchRef.current = null;
    songSrcRef.current = null;
    recRef.current = null;
  }

  const analyzeMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first");
      // Cache decoded buffer for background playback later
      const AC = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        try {
          const decodeCtx = new AC();
          const ab = await file.arrayBuffer();
          songBufferRef.current = await decodeCtx.decodeAudioData(ab.slice(0));
          await decodeCtx.close();
        } catch {
          songBufferRef.current = null;
        }
      }
      return analyzeSongFile(file, sa, (p) => {
        setPhase(p.phase);
        setProgress(p.pct);
      });
    },
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Detected ${r.notesUsed.length} notes${r.raagHint ? ` · ${r.raagHint}` : ""}`);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Could not analyze that file");
    },
  });

  async function pickFile(f: File | null) {
    if (!f) { setFile(null); return; }
    if (f.size > 15 * 1024 * 1024) {
      toast.error("File must be under 15 MB");
      return;
    }
    setFile(f);
    setResult(null);
    setReport(null);
    setProgress(0);
    songBufferRef.current = null;
    if (recording?.url) URL.revokeObjectURL(recording.url);
    setRecording(null);
  }

  function buildGuideTokens(notesUsed: string[]): SeqToken[] {
    const ordered = DEGREE_ORDER.filter((d) => notesUsed.includes(d));
    if (!ordered.length) return parseSargam("S R G M P D N Ṡ");
    const pattern = [...ordered, "Ṡ"].join(" ");
    const aaroh = parseSargam(pattern);
    const avroh = reverseTokens(aaroh);
    return [...aaroh, { semis: 0, rest: true }, ...avroh, { semis: 0, rest: true }];
  }

  async function togglePractice() {
    if (playing) {
      // Stop everything and finalize
      try { songSrcRef.current?.stop(); } catch { /* ignore */ }
      songSrcRef.current = null;
      seqRef.current?.stop();
      seqRef.current = null;
      pitchRef.current?.stop();
      pitchRef.current = null;

      // finalize recording
      if (recRef.current) {
        try {
          const rec = await recRef.current.stop();
          if (recording?.url) URL.revokeObjectURL(recording.url);
          setRecording(rec);
        } catch {
          /* ignore */
        }
        recRef.current = null;
      }
      setPlaying(false);
      finalizeReport();
      return;
    }
    if (!result) return;

    // Clear previous recording
    if (recording?.url) URL.revokeObjectURL(recording.url);
    setRecording(null);

    // reset stats
    statsRef.current = {
      voicedFrames: 0, inTuneFrames: 0, frameMs: 50,
      hits: {}, centsSum: {}, centsN: {},
    };
    setReport(null);
    setElapsed(0);

    // Optional harmonium guide
    if (useGuide) {
      const tokens = buildGuideTokens(result.notesUsed);
      const seq = startHarmoniumSequence({
        sa, tokens, bpm: 60, loop: true, volume: 0.35, drone: true,
      });
      seq.onStep((_i, t) => {
        if (!t || t.rest) {
          expectedRef.current = null;
          setExpectedNote(null);
          return;
        }
        const semi = ((t.semis % 12) + 12) % 12;
        const deg = DEGREE_ORDER[semi];
        expectedRef.current = { semis: t.semis, degree: deg };
        setExpectedNote(deg);
      });
      seqRef.current = seq;
    } else {
      setExpectedNote(null);
      expectedRef.current = null;
    }

    // Mic + pitch detection (also gives us the mic stream for recording)
    let pitch: PitchHandle;
    try {
      pitch = await startPitch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microphone denied");
      seqRef.current?.stop();
      seqRef.current = null;
      return;
    }
    const saFreq = noteToFreq(sa, 4);
    pitch.onPitch((freq) => {
      if (freq === null) return;
      const midiFromSa = 12 * Math.log2(freq / saFreq);
      const semi = Math.round(midiFromSa);
      const cents = Math.round((midiFromSa - semi) * 100);
      const deg = DEGREE_ORDER[((semi % 12) + 12) % 12];
      const { note, cents: c } = freqToNote(freq);
      setLiveNote(note);
      setLiveCents(c);
      const s = statsRef.current;
      s.voicedFrames++;
      const exp = expectedRef.current;
      if (exp) {
        const expDeg = exp.degree;
        if (deg === expDeg && Math.abs(cents) <= 25) {
          s.inTuneFrames++;
          s.hits[expDeg] = (s.hits[expDeg] ?? 0) + 1;
        }
        s.centsSum[expDeg] = (s.centsSum[expDeg] ?? 0) + Math.abs(cents);
        s.centsN[expDeg] = (s.centsN[expDeg] ?? 0) + 1;
      } else {
        // No guide: still credit any hits on the target-note set
        if (result.notesUsed.includes(deg)) {
          s.centsSum[deg] = (s.centsSum[deg] ?? 0) + Math.abs(cents);
          s.centsN[deg] = (s.centsN[deg] ?? 0) + 1;
          if (Math.abs(cents) <= 25) {
            s.inTuneFrames++;
            s.hits[deg] = (s.hits[deg] ?? 0) + 1;
          }
        }
      }
    });
    pitchRef.current = pitch;

    // Start mic-only recorder BEFORE we play the backing track,
    // so the recording captures only voice.
    try {
      recRef.current = startRecording(pitch.stream);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recording not supported in this browser");
    }

    // Play uploaded song through speakers (NOT into the recorder)
    if (songBufferRef.current) {
      try {
        await ensureRunning();
        const { ctx, master } = getAudio();
        const src = ctx.createBufferSource();
        src.buffer = songBufferRef.current;
        const g = ctx.createGain();
        g.gain.value = 0.9;
        src.connect(g).connect(master);
        src.onended = () => {
          songSrcRef.current = null;
        };
        src.start();
        songSrcRef.current = src;
      } catch {
        /* ignore */
      }
    }

    startedRef.current = Date.now();
    setPlaying(true);
  }

  function finalizeReport() {
    if (!result) return;
    const s = statsRef.current;
    const dur = startedRef.current ? Math.round((Date.now() - startedRef.current) / 1000) : 0;
    const acc = s.voicedFrames > 0 ? Math.round((s.inTuneFrames / s.voicedFrames) * 100) : 0;
    const inTuneSec = Math.round((s.inTuneFrames * 60) / Math.max(1, s.voicedFrames) * (dur / 60));
    const targets = result.notesUsed;
    const misses = targets.filter((n) => (s.hits[n] ?? 0) < 3);
    let weakest: { note: string; avgCents: number } | null = null;
    targets.forEach((n) => {
      const N = s.centsN[n] ?? 0;
      if (N < 5) return;
      const avg = (s.centsSum[n] ?? 0) / N;
      if (!weakest || avg > weakest.avgCents) weakest = { note: n, avgCents: Math.round(avg) };
    });
    setReport({
      durationSec: dur,
      accuracyPct: acc,
      inTuneSec,
      hits: { ...s.hits },
      misses,
      weakestNote: weakest,
      targetNotes: targets,
    });
  }

  function resetStudio() {
    cleanupAll();
    if (recording?.url) URL.revokeObjectURL(recording.url);
    setFile(null);
    setResult(null);
    setReport(null);
    setRecording(null);
    setElapsed(0);
    setProgress(0);
    setPhase("");
    setLiveNote(null);
    setLiveCents(null);
    setExpectedNote(null);
    setPlaying(false);
    songBufferRef.current = null;
    startedRef.current = null;
    statsRef.current = {
      voicedFrames: 0, inTuneFrames: 0, frameMs: 50,
      hits: {}, centsSum: {}, centsN: {},
    };
    expectedRef.current = null;
    toast.success("Studio reset");
  }

  function downloadRecording() {
    if (!recording) return;
    const a = document.createElement("a");
    a.href = recording.url;
    a.download = `riyaz-${tsStamp()}.${recording.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!report || report.durationSec < 10) throw new Error("Practice a bit longer first");
      await log({
        data: {
          duration_sec: report.durationSec,
          lesson_id: null,
          tools: { studio: true, sa, notes_used: result?.notesUsed ?? [], accuracy_pct: report.accuracyPct },
          notes: `Studio: ${report.accuracyPct}% accuracy on ${result?.notesUsed.join(" ") ?? ""}`,
        },
      });
    },
    onSuccess: () => toast.success("Saved to history"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <AppShell title="Studio">
      <div className="mb-6 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Upload a song up to 3 minutes. We detect the notes it uses, play the song while you sing along
          (your voice is recorded, the backing track is not), then show a report and let you download your take.
        </p>
        <Button variant="outline" size="sm" onClick={resetStudio} className="shrink-0">
          <RotateCcw className="mr-2 h-4 w-4" /> Reset
        </Button>
      </div>

      {/* 1. Upload */}
      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">1</span>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Upload song</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-4 py-4 text-sm hover:border-primary/60">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">
              {file ? file.name : "Choose audio file — mp3, wav, m4a (max 3 min, 15 MB)"}
            </span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="space-y-1">
            <Label className="text-xs">Sa</Label>
            <Select value={sa} onValueChange={setSa}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTE_NAMES.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => analyzeMut.mutate()}
            disabled={!file || analyzeMut.isPending}
            className="self-end"
          >
            {analyzeMut.isPending ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
        {analyzeMut.isPending && (
          <div className="mt-4">
            <Progress value={progress} />
            <div className="mono-num mt-1 text-xs text-muted-foreground">{phase} · {progress}%</div>
          </div>
        )}
      </Card>

      {/* 2. Analysis result */}
      {result && (
        <Card className="mt-4 p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">2</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">What we heard</h2>
          </div>
          <div className="mono-num grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Duration</div>
              <div className="text-foreground">{Math.round(result.durationSec)}s</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Suggested Sa</div>
              <div className="text-foreground">
                {result.saSuggestion}
                {result.saSuggestion !== sa && (
                  <button
                    className="ml-2 text-xs text-primary underline"
                    onClick={() => setSa(result.saSuggestion)}
                  >
                    use
                  </button>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Raag hint</div>
              <div className="text-foreground">{result.raagHint ?? "—"}</div>
            </div>
          </div>
          <div className="mt-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Notes used</div>
            <div className="mono-num mt-2 flex flex-wrap gap-2">
              {DEGREE_ORDER.map((d) => (
                <Badge
                  key={d}
                  variant={result.notesUsed.includes(d) ? "default" : "outline"}
                  className="tracking-widest"
                >
                  {d}
                </Badge>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Detected sequence</div>
            <div className="mono-num mt-2 rounded-md bg-muted p-3 text-center text-sm tracking-widest">
              {result.pattern.length ? result.pattern.join(" ") : "—"}
            </div>
          </div>
        </Card>
      )}

      {/* 3. Riyaz along */}
      {result && (
        <Card className="mt-4 p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">3</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Riyaz along</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Switch id="guide" checked={useGuide} onCheckedChange={setUseGuide} disabled={playing} />
              <Label htmlFor="guide" className="text-sm">Also play harmonium guide</Label>
            </div>
            <div className="mono-num flex items-center justify-end gap-6 text-sm">
              {useGuide && (
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">Target</div>
                  <div className="text-2xl font-semibold text-primary">{expectedNote ?? "—"}</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-xs text-muted-foreground">You</div>
                <div className={`text-2xl font-semibold ${liveCents !== null && Math.abs(liveCents) <= 15 ? "text-primary" : "text-foreground"}`}>
                  {liveNote ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {liveCents !== null ? `${liveCents > 0 ? "+" : ""}${liveCents}¢` : ""}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="mono-num text-4xl font-semibold">{mm}:{ss}</div>
            <Button size="lg" onClick={togglePractice} className="h-14 w-14 rounded-full p-0">
              {playing ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <p className="text-xs text-muted-foreground">
              {playing
                ? "Song is playing — sing along. Only your voice is being recorded."
                : "Tap to play the song and record your singing (mic access required)."}
            </p>
          </div>
        </Card>
      )}

      {/* 4. Your recording */}
      {recording && !playing && (
        <Card className="mt-4 p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">4</span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Your recording</h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Voice only — the backing track was not mixed in.
          </p>
          <audio controls src={recording.url} className="w-full" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={downloadRecording}>
              <Download className="mr-2 h-4 w-4" /> Save to device
            </Button>
          </div>
        </Card>
      )}

      {/* 5. Report */}
      {report && (
        <Card className="mt-4 p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              {recording ? 5 : 4}
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Report</h2>
          </div>
          <div className="mono-num grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
              <div className="text-3xl font-semibold text-primary">{report.accuracyPct}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">In-tune time</div>
              <div className="text-foreground">{report.inTuneSec}s / {report.durationSec}s</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Weakest note</div>
              <div className="text-foreground">
                {report.weakestNote ? `${report.weakestNote.note} · avg ${report.weakestNote.avgCents}¢` : "—"}
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Notes you hit</div>
              <div className="mono-num mt-2 flex flex-wrap gap-2">
                {report.targetNotes.filter((n) => !report.misses.includes(n)).map((n) => (
                  <Badge key={n} className="tracking-widest"><Check className="mr-1 h-3 w-3" />{n}</Badge>
                ))}
                {report.targetNotes.filter((n) => !report.misses.includes(n)).length === 0 && (
                  <span className="text-xs text-muted-foreground">None yet — keep practicing.</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Needs work</div>
              <div className="mono-num mt-2 flex flex-wrap gap-2">
                {report.misses.map((n) => (
                  <Badge key={n} variant="outline" className="tracking-widest"><X className="mr-1 h-3 w-3" />{n}</Badge>
                ))}
                {report.misses.length === 0 && (
                  <span className="text-xs text-muted-foreground">All target notes hit — nice work.</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Play className="mr-2 h-4 w-4" /> Save to history
            </Button>
            <Button variant="outline" onClick={resetStudio}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset &amp; upload new song
            </Button>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
