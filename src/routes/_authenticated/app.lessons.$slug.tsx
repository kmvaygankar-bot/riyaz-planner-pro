import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { listLessons, logPracticeSession, markLessonComplete } from "@/lib/practice.functions";
import { startHarmoniumSequence, parseSargam, reverseTokens, type SequenceHandle, type SeqToken } from "@/lib/audio/harmonium";
import { startTala, getTala, type TalaHandle } from "@/lib/audio/tala";
import { Play, Square, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { usePremium } from "@/lib/premium";
import { useAds } from "@/lib/ads";


export const Route = createFileRoute("/_authenticated/app/lessons/$slug")({
  head: () => ({ meta: [{ title: "Lesson — Riyaz" }] }),
  component: LessonPage,
});

function LessonPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const list = useServerFn(listLessons);
  const log = useServerFn(logPracticeSession);
  const complete = useServerFn(markLessonComplete);

  const { data: lessons = [] } = useQuery({ queryKey: ["lessons"], queryFn: () => list() });
  const lesson = lessons.find((l) => l.slug === slug);
  const { isPremium } = usePremium();
  const locked = !!lesson && lesson.level.toLowerCase() === "advanced" && !isPremium;

  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [bpm, setBpm] = useState<number>(60);
  const harRef = useRef<SequenceHandle | null>(null);
  const talaRef = useRef<TalaHandle | null>(null);
  const startedRef = useRef<number | null>(null);


  useEffect(() => () => {
    harRef.current?.stop();
    talaRef.current?.stop();
  }, []);

  // Initialize BPM from lesson + persisted per-lesson override
  useEffect(() => {
    if (!lesson) return;
    const key = `riyaz:lesson-bpm:${slug}`;
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    const n = saved ? Number(saved) : NaN;
    setBpm(Number.isFinite(n) && n >= 40 && n <= 120 ? n : lesson.bpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id]);

  function updateBpm(v: number) {
    setBpm(v);
    try { window.localStorage.setItem(`riyaz:lesson-bpm:${slug}`, String(v)); } catch { /* ignore */ }
  }


  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      if (startedRef.current) setElapsed(Math.floor((Date.now() - startedRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [playing]);

  const completeMut = useMutation({
    mutationFn: async () => {
      if (!lesson) return;
      if (elapsed >= 30) {
        await log({ data: { duration_sec: elapsed, lesson_id: lesson.id, tools: { harmonium: true, tala: !!lesson.tala } } });
      }
      await complete({ data: { lesson_id: lesson.id } });
    },
    onSuccess: () => {
      toast.success("Marked complete");
      navigate({ to: "/app/lessons" });
    },
  });

  if (!lesson) {
    return <AppShell title="Lesson"><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  }

  if (locked) {
    return (
      <AppShell title={lesson.title}>
        <Link to="/app/lessons" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Lessons
        </Link>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">This lesson is part of Riyaz Premium</h2>
          <p className="mt-2 text-sm text-muted-foreground">{lesson.instructions}</p>
          <Button className="mt-6" onClick={() => navigate({ to: "/app/premium" })}>
            Unlock with Premium
          </Button>
        </Card>
      </AppShell>
    );
  }

  const target = (lesson as { duration_target_sec?: number | null }).duration_target_sec ?? null;

  function toggle() {
    if (!lesson) return;
    if (playing) {
      harRef.current?.stop();
      talaRef.current?.stop();
      harRef.current = null;
      talaRef.current = null;
      setActiveStep(null);
      setPlaying(false);
    } else {
      const aaroh = parseSargam(lesson.pattern || "S R G M P D N Ṡ");
      const avroh = reverseTokens(aaroh);
      const tokens: SeqToken[] = [...aaroh, { semis: 0, rest: true }, ...avroh, { semis: 0, rest: true }];
      const h = startHarmoniumSequence({ sa: lesson.target_sa, tokens, bpm, loop: true, volume: 0.55, drone: true });
      h.onStep((i) => setActiveStep(i));
      harRef.current = h;
      if (lesson.tala) {
        talaRef.current = startTala({ tala: getTala(lesson.tala), bpm });
      }

      startedRef.current = Date.now() - elapsed * 1000;
      setPlaying(true);
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <AppShell title={lesson.title}>
      <Link to="/app/lessons" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Lessons
      </Link>
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">{lesson.instructions}</p>
        {lesson.pattern && (
          <div className="mono-num mt-4 rounded-md bg-muted p-4 text-center text-lg tracking-widest">
            {lesson.pattern}
            {playing && activeStep !== null && (
              <div className="mt-2 text-xs text-primary">▸ playing note {activeStep + 1}</div>
            )}
          </div>
        )}
        <div className="mono-num mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Sa: <span className="text-foreground">{lesson.target_sa}</span></span>
          <span>Tempo: <span className="text-foreground">{lesson.bpm} bpm</span></span>
          {lesson.tala && <span>Tala: <span className="text-foreground">{lesson.tala}</span></span>}
          {target ? (
            <span>Target: <span className="text-foreground">{Math.round(target / 60)} min</span></span>
          ) : (
            <span>Loops: <span className="text-foreground">{lesson.loop_count}</span></span>
          )}
          <span>Drone: <span className="text-foreground">Harmonium</span></span>
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Tempo</Label>
            <span className="mono-num text-sm text-muted-foreground">{bpm} bpm</span>
          </div>
          <Slider
            min={40}
            max={120}
            step={2}
            value={[bpm]}
            onValueChange={(v) => updateBpm(v[0])}
            disabled={playing}
          />
          <p className="text-xs text-muted-foreground">
            Suggested: {lesson.bpm} bpm. Slow down while learning, speed up as you get comfortable.
          </p>
        </div>
      </Card>

      <Card className="mt-4 p-6">

        <div className="flex flex-col items-center gap-4">
          <div className="mono-num text-5xl font-semibold">{mm}:{ss}</div>
          <div className="flex gap-3">
            <Button size="lg" onClick={toggle} className="h-14 w-14 rounded-full p-0">
              {playing ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button size="lg" variant="outline" onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
              <Check className="mr-2 h-4 w-4" /> Mark complete
            </Button>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
