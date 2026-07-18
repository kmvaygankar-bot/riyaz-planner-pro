import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startTala, getTala, TALAS, type TalaHandle } from "@/lib/audio/tala";
import { Play, Square } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/tala")({
  head: () => ({ meta: [{ title: "Tala — Riyaz" }] }),
  component: TalaPage,
});

function TalaPage() {
  const [talaId, setTalaId] = useState("teentaal");
  const [bpm, setBpm] = useState(80);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<{ beat: number; accent: number } | null>(null);
  const handleRef = useRef<TalaHandle | null>(null);
  const tala = getTala(talaId);

  useEffect(() => () => { handleRef.current?.stop(); }, []);
  useEffect(() => { handleRef.current?.setBpm(bpm); }, [bpm]);

  function toggle() {
    if (playing) {
      handleRef.current?.stop();
      handleRef.current = null;
      setPlaying(false);
      setCurrent(null);
    } else {
      const h = startTala({ tala, bpm });
      h.onBeat((beat, accent) => setCurrent({ beat, accent }));
      handleRef.current = h;
      setPlaying(true);
    }
  }

  useEffect(() => {
    if (playing) {
      handleRef.current?.stop();
      const h = startTala({ tala, bpm });
      h.onBeat((beat, accent) => setCurrent({ beat, accent }));
      handleRef.current = h;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talaId]);

  // Tap tempo
  const tapsRef = useRef<number[]>([]);
  function tap() {
    const now = performance.now();
    tapsRef.current.push(now);
    if (tapsRef.current.length > 5) tapsRef.current.shift();
    const taps = tapsRef.current;
    if (taps.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const newBpm = Math.round(60000 / avg);
      if (newBpm >= 30 && newBpm <= 240) setBpm(newBpm);
    }
  }

  return (
    <AppShell title="Tala">
      <Card className="p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="mono-num text-xs uppercase tracking-widest text-muted-foreground">BPM</div>
            <div className="mono-num mt-1 text-7xl font-semibold text-tala">{bpm}</div>
          </div>
          <div className="flex gap-3">
            <Button size="lg" onClick={toggle} className="h-16 w-16 rounded-full p-0" aria-label={playing ? "Stop" : "Play"}>
              {playing ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
            <Button size="lg" variant="outline" onClick={tap}>Tap</Button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {tala.pattern.map((accent, i) => {
            const active = current?.beat === i && playing;
            return (
              <div
                key={i}
                className={`mono-num flex h-11 w-11 items-center justify-center rounded-md border text-sm transition ${
                  active
                    ? accent === 3
                      ? "border-primary bg-primary text-primary-foreground"
                      : accent === 0
                      ? "border-muted-foreground/40 bg-muted text-muted-foreground"
                      : "border-tala bg-tala text-tala-foreground"
                    : accent === 3
                    ? "border-primary/50 text-primary"
                    : accent === 0
                    ? "border-border text-muted-foreground/60"
                    : accent === 2
                    ? "border-tala/60 text-tala"
                    : "border-border text-foreground"
                }`}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-4 space-y-6 p-6">
        <div className="space-y-2">
          <Label>Tala</Label>
          <Select value={talaId} onValueChange={setTalaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TALAS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} · {t.beats} beats · {t.tradition === "hindustani" ? "Hindustani" : "Carnatic"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Tempo</Label>
            <span className="mono-num text-sm text-muted-foreground">{bpm} bpm</span>
          </div>
          <Slider min={30} max={240} step={1} value={[bpm]} onValueChange={(v) => setBpm(v[0])} />
        </div>
      </Card>
    </AppShell>
  );
}
