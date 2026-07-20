import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { listPracticeSessions, logPracticeSession } from "@/lib/practice.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Music, Timer, GraduationCap, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAds, useScreenBanner } from "@/lib/ads";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Today — Riyaz" }] }),
  component: TodayPage,
});

function computeStreak(dates: Date[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  let streak = 0;
  const cur = new Date();
  for (;;) {
    const key = cur.toISOString().slice(0, 10);
    if (set.has(key)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else if (streak === 0) {
      cur.setDate(cur.getDate() - 1);
      const yesterday = cur.toISOString().slice(0, 10);
      if (!set.has(yesterday)) break;
    } else break;
  }
  return streak;
}

function TodayPage() {
  const list = useServerFn(listPracticeSessions);
  const log = useServerFn(logPracticeSession);
  const [name, setName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as { display_name?: string; full_name?: string } | undefined;
      setName(meta?.display_name || meta?.full_name || data.user?.email?.split("@")[0] || "");
    });
  }, []);

  const { data: sessions = [] } = useQuery({
    queryKey: ["practice-sessions"],
    queryFn: () => list(),
  });

  const quickLog = useMutation({
    mutationFn: (minutes: number) =>
      log({ data: { duration_sec: minutes * 60, tools: { quick: true } } }),
    onSuccess: () => toast.success("Session logged"),
  });

  const streak = computeStreak(sessions.map((s) => new Date(s.started_at)));
  const totalMin = Math.round(sessions.reduce((a, s) => a + s.duration_sec, 0) / 60);

  const tiles = [
    { to: "/app/tanpura", label: "Tanpura", icon: Music, hint: "Steady Sa" },
    { to: "/app/tala", label: "Tala", icon: Timer, hint: "Keep time" },
    { to: "/app/lessons", label: "Lessons", icon: GraduationCap, hint: "Guided" },
    { to: "/app/tuner", label: "Tuner", icon: Mic, hint: "Pitch check" },
  ] as const;

  return (
    <AppShell title={name ? `Namaste, ${name}` : "Today"}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Streak</div>
          <div className="mono-num mt-2 text-4xl font-semibold">{streak}<span className="text-lg text-muted-foreground"> days</span></div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total practice</div>
          <div className="mono-num mt-2 text-4xl font-semibold">{totalMin}<span className="text-lg text-muted-foreground"> min</span></div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Sessions</div>
          <div className="mono-num mt-2 text-4xl font-semibold">{sessions.length}</div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Today's riyaz</div>
        <h2 className="mt-2 text-xl font-semibold">Warm up, then flow</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. 3 min — Sa hold with tanpura</li>
          <li>2. 7 min — Ascending alankar to a comfortable tempo</li>
          <li>3. 5 min — Free practice on a lesson of your choice</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/app/tanpura" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Start with tanpura
          </Link>
          <Button variant="outline" onClick={() => quickLog.mutate(15)} disabled={quickLog.isPending}>
            Log 15 min
          </Button>
        </div>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="group">
            <Card className="p-5 transition group-hover:border-primary/60">
              <t.icon className="h-5 w-5 text-primary" />
              <div className="mt-3 text-base font-semibold">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.hint}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-muted-foreground">Recent sessions</h3>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No sessions yet. Every minute counts.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {sessions.slice(0, 6).map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{new Date(s.started_at).toLocaleString()}</span>
                <span className="mono-num text-muted-foreground">
                  {Math.round(s.duration_sec / 60)} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
