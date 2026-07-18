import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { startPitch, type PitchHandle } from "@/lib/audio/pitch";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/tuner")({
  head: () => ({ meta: [{ title: "Tuner — Riyaz" }] }),
  component: TunerPage,
});

function TunerPage() {
  const [active, setActive] = useState(false);
  const [freq, setFreq] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cents, setCents] = useState<number | null>(null);
  const handleRef = useRef<PitchHandle | null>(null);

  useEffect(() => () => { handleRef.current?.stop(); }, []);

  async function toggle() {
    if (active) {
      handleRef.current?.stop();
      handleRef.current = null;
      setActive(false);
      setFreq(null); setNote(null); setCents(null);
      return;
    }
    try {
      const h = await startPitch();
      h.onPitch((f, n, c) => { setFreq(f); setNote(n); setCents(c); });
      handleRef.current = h;
      setActive(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Microphone access denied");
    }
  }

  const inTune = cents !== null && Math.abs(cents) <= 10;

  return (
    <AppShell title="Tuner">
      <Card className="p-8">
        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Detected</div>
            <div className={`mono-num mt-2 text-8xl font-semibold ${inTune ? "text-primary" : "text-foreground"}`}>
              {note ?? "—"}
            </div>
            <div className="mono-num mt-2 text-sm text-muted-foreground">
              {freq ? `${freq.toFixed(1)} Hz` : "Listening..."}
            </div>
          </div>

          <div className="relative h-24 w-full max-w-md">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <div className="absolute left-1/2 top-1/2 h-16 w-px -translate-x-1/2 -translate-y-1/2 bg-primary" />
            {cents !== null && (
              <div
                className={`absolute top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition-transform ${
                  inTune ? "bg-primary" : "bg-tala"
                }`}
                style={{
                  left: "50%",
                  transform: `translate(${Math.max(-50, Math.min(50, cents))}%, -50%)`,
                }}
              />
            )}
            <div className="mono-num absolute -bottom-6 left-0 text-xs text-muted-foreground">-50¢</div>
            <div className="mono-num absolute -bottom-6 right-0 text-xs text-muted-foreground">+50¢</div>
            <div className={`mono-num absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs ${inTune ? "text-primary" : "text-muted-foreground"}`}>
              {cents !== null ? `${cents > 0 ? "+" : ""}${cents}¢` : "0¢"}
            </div>
          </div>

          <Button size="lg" onClick={toggle} className="mt-6 h-14 w-14 rounded-full p-0">
            {active ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <p className="text-xs text-muted-foreground">
            {active ? "Sing steadily into your mic" : "Tap to allow microphone"}
          </p>
        </div>
      </Card>
    </AppShell>
  );
}
