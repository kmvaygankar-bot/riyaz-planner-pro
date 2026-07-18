import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startTanpura, type TanpuraPattern } from "@/lib/audio/tanpura";
import { NOTE_NAMES } from "@/lib/audio/transport";
import { Play, Square } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/tanpura")({
  head: () => ({ meta: [{ title: "Tanpura — Riyaz" }] }),
  component: TanpuraPage,
});

function TanpuraPage() {
  const [sa, setSa] = useState("C");
  const [pattern, setPattern] = useState<TanpuraPattern>("pa-sa");
  const [bpm, setBpm] = useState(48);
  const [volume, setVolume] = useState(0.7);
  const [playing, setPlaying] = useState(false);
  const handleRef = useRef<ReturnType<typeof startTanpura> | null>(null);

  useEffect(() => () => { handleRef.current?.stop(); }, []);
  useEffect(() => { handleRef.current?.setVolume(volume); }, [volume]);
  useEffect(() => { handleRef.current?.setSpeed(bpm); }, [bpm]);

  function toggle() {
    if (playing) {
      handleRef.current?.stop();
      handleRef.current = null;
      setPlaying(false);
    } else {
      handleRef.current = startTanpura({ sa, pattern, bpm, volume });
      setPlaying(true);
    }
  }

  useEffect(() => {
    if (playing) {
      handleRef.current?.stop();
      handleRef.current = startTanpura({ sa, pattern, bpm, volume });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sa, pattern]);

  return (
    <AppShell title="Tanpura">
      <Card className="p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="mono-num text-xs uppercase tracking-widest text-muted-foreground">Sa</div>
            <div className="mono-num mt-1 text-7xl font-semibold text-primary">{sa}</div>
          </div>
          <Button
            size="lg"
            onClick={toggle}
            className="h-16 w-16 rounded-full p-0"
            aria-label={playing ? "Stop" : "Play"}
          >
            {playing ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>
          <div className="text-xs text-muted-foreground">
            {playing ? "Playing" : "Tap to start"}
          </div>
        </div>
      </Card>

      <Card className="mt-4 space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Pitch (Sa)</Label>
            <Select value={sa} onValueChange={setSa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTE_NAMES.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>String pattern</Label>
            <Select value={pattern} onValueChange={(v) => setPattern(v as TanpuraPattern)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pa-sa">Pa - Sa - Sa - Sa</SelectItem>
                <SelectItem value="ma-sa">Ma - Sa - Sa - Sa</SelectItem>
                <SelectItem value="ni-sa">Ni - Sa - Sa - Sa</SelectItem>
                <SelectItem value="sa-sa">Sa - Sa - Sa - Sa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Jhala speed</Label>
            <span className="mono-num text-sm text-muted-foreground">{bpm} spm</span>
          </div>
          <Slider min={20} max={90} step={1} value={[bpm]} onValueChange={(v) => setBpm(v[0])} />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Volume</Label>
            <span className="mono-num text-sm text-muted-foreground">{Math.round(volume * 100)}</span>
          </div>
          <Slider min={0} max={100} step={1} value={[Math.round(volume * 100)]} onValueChange={(v) => setVolume(v[0] / 100)} />
        </div>
      </Card>
    </AppShell>
  );
}
