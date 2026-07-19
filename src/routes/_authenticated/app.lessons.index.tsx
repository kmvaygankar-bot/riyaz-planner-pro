import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listLessons } from "@/lib/practice.functions";
import { usePremium } from "@/lib/premium";
import { Lock, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/lessons/")({
  head: () => ({ meta: [{ title: "Lessons — Riyaz" }] }),
  component: LessonsPage,
});

function isPremiumLesson(level: string) {
  return level.toLowerCase() === "advanced";
}

function LessonsPage() {
  const fn = useServerFn(listLessons);
  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["lessons"],
    queryFn: () => fn(),
  });
  const { isPremium } = usePremium();

  const grouped: Record<string, typeof lessons> = {};
  for (const l of lessons) {
    (grouped[l.category] ??= []).push(l);
  }

  return (
    <AppShell title="Lessons">
      {!isPremium && (
        <Link to="/app/premium">
          <Card className="mb-6 flex items-center justify-between border-primary/40 p-4">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">Unlock advanced lessons</div>
                <div className="text-xs text-muted-foreground">
                  Alankars, paltas, meend and raags — with Riyaz Premium.
                </div>
              </div>
            </div>
            <Badge>Upgrade</Badge>
          </Card>
        </Link>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {cat}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((l) => {
              const locked = isPremiumLesson(l.level) && !isPremium;
              const inner = (
                <Card className={`p-4 transition ${locked ? "opacity-70" : "hover:border-primary/60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{l.title}</h3>
                    <div className="flex items-center gap-1">
                      {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <Badge variant="outline" className="text-[10px]">{l.level}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{l.instructions}</p>
                  <div className="mono-num mt-3 flex gap-3 text-xs text-muted-foreground">
                    <span>Sa {l.target_sa}</span>
                    <span>{l.bpm} bpm</span>
                    {l.tala && <span>{l.tala}</span>}
                    {locked && <span className="text-primary">Premium</span>}
                  </div>
                </Card>
              );
              return locked ? (
                <Link key={l.id} to="/app/premium">{inner}</Link>
              ) : (
                <Link key={l.id} to="/app/lessons/$slug" params={{ slug: l.slug }}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </AppShell>
  );
}
