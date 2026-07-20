import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startTanpura, type TanpuraPattern } from "@/lib/audio/tanpura";
import { startHarmonium, type HarmoniumHandle, type HarmoniumNoteSet } from "@/lib/audio/harmonium";
import { NOTE_NAMES } from "@/lib/audio/transport";
import { Play, Square } from "lucide-react";
import { useScreenBanner } from "@/lib/ads";

export const Route = createFileRoute("/_authenticated/app/tanpura")({
  head: () => ({ meta: [{ title: "Drone — Riyaz" }] }),
  component: TanpuraPage,
});

type Instrument = "tanpura" | "harmonium";

function TanpuraPage() {
  const [instrument, setInstrument] = useState<Instrument>("tanpura");
  const [sa, setSa] = useState("C");
  const [pattern, setPattern] = useState<TanpuraPattern>("pa-sa");
  const [noteSet, setNoteSet] = useState<HarmoniumNoteSet>("sa-pa");
  const [bpm, setBpm] = useState(48);
  const [volume, setVolume] = useState(0.7);
  const [playing, setPlaying] = useState(false);
  const tanRef = useRef<ReturnType<typeof startTanpura> | null>(null);
  const harRef = useRef<HarmoniumHandle | null>(null);

  function stopAll() {
    tanRef.current?.stop();
    harRef.current?.stop();
    tanRef.current = null;
    harRef.current = null;
  }

  function startCurrent() {
    if (instrument === "tanpura") {
      tanRef.current = startTanpura({ sa, pattern, bpm, volume });
    } else {
      harRef.current = startHarmonium({ sa, set: noteSet, volume });
    }
  }

  useEffect(() => () => stopAll(), []);

  useEffect(() => {
    tanRef.current?.setVolume(volume);
    harRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => { tanRef.current?.setSpeed(bpm); }, [bpm]);

  useEffect(() => {
    if (playing) {
      stopAll();
      startCurrent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sa, pattern, noteSet, instrument]);

  function toggle() {
    if (playing) {
      stopAll();
      setPlaying(false);
    } else {
      startCurrent();
      setPlaying(true);
    }
  }

  return (
    <AppShell title="Drone">
      <Card className="p-6">
        <Tabs value={instrument} onValueChange={(v) => setInstrument(v as Instrument)}>
          <TabsList className="mx-auto mb-6 grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="tanpura">Tanpura</TabsTrigger>
            <TabsTrigger value="harmonium">Harmonium</TabsTrigger>
          </TabsList>
        </Tabs>
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

          {instrument === "tanpura" ? (
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
          ) : (
            <div className="space-y-2">
              <Label>Reed notes</Label>
              <Select value={noteSet} onValueChange={(v) => setNoteSet(v as HarmoniumNoteSet)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sa">Sa only</SelectItem>
                  <SelectItem value="sa-pa">Sa + Pa</SelectItem>
                  <SelectItem value="sa-ma">Sa + Ma</SelectItem>
                  <SelectItem value="sa-pa-sa8">Sa + Pa + Sa'</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {instrument === "tanpura" && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Jhala speed</Label>
              <span className="mono-num text-sm text-muted-foreground">{bpm} spm</span>
            </div>
            <Slider min={20} max={90} step={1} value={[bpm]} onValueChange={(v) => setBpm(v[0])} />
          </div>
        )}

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
