import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { listPracticeSessions } from "@/lib/practice.functions";

export const Route = createFileRoute("/_authenticated/app/history")({
  head: () => ({ meta: [{ title: "History — Riyaz" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const fn = useServerFn(listPracticeSessions);
  const { data: sessions = [] } = useQuery({ queryKey: ["practice-sessions"], queryFn: () => fn() });

  // Build 12-week heatmap (84 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { key: string; minutes: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ key: d.toISOString().slice(0, 10), minutes: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const s of sessions) {
    const k = new Date(s.started_at).toISOString().slice(0, 10);
    const d = byKey.get(k);
    if (d) d.minutes += s.duration_sec / 60;
  }

  function shade(min: number) {
    if (min === 0) return "bg-muted";
    if (min < 5) return "bg-primary/25";
    if (min < 15) return "bg-primary/50";
    if (min < 30) return "bg-primary/75";
    return "bg-primary";
  }

  const totalMin = Math.round(sessions.reduce((a, s) => a + s.duration_sec, 0) / 60);
  const last7 = days.slice(-7).reduce((a, d) => a + d.minutes, 0);

  return (
    <AppShell title="History">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">This week</div>
          <div className="mono-num mt-2 text-3xl font-semibold">{Math.round(last7)}<span className="text-base text-muted-foreground"> min</span></div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">All-time</div>
          <div className="mono-num mt-2 text-3xl font-semibold">{totalMin}<span className="text-base text-muted-foreground"> min</span></div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Sessions</div>
          <div className="mono-num mt-2 text-3xl font-semibold">{sessions.length}</div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 text-sm font-semibold">Last 12 weeks</div>
        <div className="grid grid-flow-col grid-rows-7 gap-1">
          {days.map((d) => (
            <div
              key={d.key}
              title={`${d.key}: ${Math.round(d.minutes)} min`}
              className={`h-3 w-3 rounded-sm ${shade(d.minutes)}`}
            />
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="mb-3 text-sm font-semibold">All sessions</div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span>{new Date(s.started_at).toLocaleString()}</span>
                <span className="mono-num text-muted-foreground">{Math.round(s.duration_sec / 60)} min</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
