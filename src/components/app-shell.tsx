import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Home, Music, Timer, GraduationCap, Mic, BarChart3, User, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/app", label: "Today", icon: Home, exact: true },
  { to: "/app/tanpura", label: "Tanpura", icon: Music },
  { to: "/app/tala", label: "Tala", icon: Timer },
  { to: "/app/lessons", label: "Lessons", icon: GraduationCap },
  { to: "/app/tuner", label: "Tuner", icon: Mic },
  { to: "/app/history", label: "History", icon: BarChart3 },
  { to: "/app/profile", label: "Profile", icon: User },
];

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-sidebar px-3 py-6 md:flex">
        <Link to="/app" className="mb-8 flex items-center gap-2 px-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold tracking-wide">RIYAZ</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={signOut}
          className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold tracking-wide">RIYAZ</span>
        </div>
        <button onClick={signOut} className="text-xs text-muted-foreground">
          Sign out
        </button>
      </header>

      <main className="md:pl-56">
        <div className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 md:py-10">
          <h1 className="mb-6 text-2xl font-semibold sm:text-3xl">{title}</h1>
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex justify-around border-t border-border bg-background/95 py-2 backdrop-blur md:hidden">
        {NAV.slice(0, 5).map((item) => {
          const active = item.exact ? path === item.to : path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
