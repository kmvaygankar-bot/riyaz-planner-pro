import { createFileRoute, Link } from "@tanstack/react-router";
import { Music, Timer, GraduationCap, Mic } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Music;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold tracking-wide">RIYAZ</span>
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="pt-16 pb-20 sm:pt-24 sm:pb-28">
          <p className="mono-num text-xs uppercase tracking-widest text-muted-foreground">
            Daily vocal riyaz
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
            A calm space for your{" "}
            <span className="text-primary">everyday practice.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Tanpura, tala, guided lessons and real-time pitch feedback — for
            Hindustani and Carnatic vocalists at every level.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Start practicing
            </Link>
            <a
              href="#features"
              className="rounded-md border border-border px-5 py-3 text-sm font-medium hover:bg-accent"
            >
              What's inside
            </a>
          </div>
        </section>

        <section id="features" className="grid gap-4 pb-20 sm:grid-cols-2">
          <Feature
            icon={Music}
            title="Tanpura & shruti"
            desc="Steady drone tuned to your Sa, with classic string patterns and adjustable jhala speed."
          />
          <Feature
            icon={Timer}
            title="Tala metronome"
            desc="Teentaal, Ektaal, Adi, Rupak and more — with visible sam and clear accents."
          />
          <Feature
            icon={GraduationCap}
            title="Guided lessons"
            desc="Alankars, varisai, sargam and beginner raag exercises with built-in drone and tala."
          />
          <Feature
            icon={Mic}
            title="Pitch feedback"
            desc="Live tuner tells you which swara you're on and how many cents off — practice with your ears open."
          />
        </section>

        <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
          Made for singers who show up every day.
        </footer>
      </main>
    </div>
  );
}
