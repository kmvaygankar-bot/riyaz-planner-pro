# Riyaz — Singing Practice App

A modern-minimal, all-levels riyaz companion covering Hindustani and Carnatic vocal practice. Four core tools (tanpura, tala, guided lessons, pitch feedback) tied together by a daily practice flow with streaks and history.

## User experience

### Home / Today
- Greeting, current streak, "Today's riyaz" card (10–30 min routine: warm‑up drone → sargam/varisai → free practice).
- Quick-launch tiles: Tanpura, Tala, Lessons, Tuner.
- Recent sessions list.

### Tanpura & Shruti Drone
- Pitch selector (C, C#, D … B; plus fine cents ±50).
- String pattern: Pa–Sa–Sa–Sa, Ma–Sa–Sa–Sa, Ni–Sa–Sa–Sa, Sa–Sa (Carnatic).
- Tempo (jhala speed), volume, gentle fade in/out, sleep timer.
- Background-safe playback while other panels are open.

### Tala / Metronome
- Presets: Teentaal (16), Ektaal (12), Jhaptaal (10), Rupak (7), Dadra (6), Kaharwa (8), Adi (8), Rupaka (3), Misra Chapu (7), Khanda Chapu (5).
- BPM 30–240, tap tempo, accent on sam, visual beat indicator, count-in.
- Combine with tanpura in one transport.

### Guided Lessons
- Structured tracks: Warm‑ups, Alankars (10 patterns), Sargam Geet, Sarali/Janta Varisai, Basic Raag (Yaman, Bhairav, Bhupali), Bandish intros.
- Each lesson: description, target pitch, tempo, loop count, embedded tanpura+tala, "Mark complete".

### Pitch Detection & Feedback
- Mic-based real-time pitch (YIN/autocorrelation via Web Audio + AudioWorklet).
- Shows detected note, cents deviation from target Sa/scale note, rolling accuracy %.
- Session summary: time in-tune, notes hit, weakest swaras.

### Practice Session & History
- Start/stop timer that logs: duration, tools used, lesson, pitch stats.
- Calendar heatmap, streak, weekly minutes chart.

### Auth & Profile
- Email/password + Google sign-in (Lovable Cloud).
- Profile: display name, tradition preference (Hindustani/Carnatic/Both), default Sa, voice type.

## Design direction

Modern minimal: dark-first UI, generous whitespace, monospaced numerics for BPM/cents, subtle motion. Neutral slate background, single warm accent (amber) for active/on-pitch states, cool accent (teal) for tala. No decorative ornaments; typography-led.

## Information architecture (routes)

```text
/                       Landing (public)
/auth                   Sign in / up
/app                    Today (protected)
/app/tanpura            Tanpura
/app/tala               Tala
/app/lessons            Lesson library
/app/lessons/$id        Lesson player
/app/tuner              Pitch feedback
/app/history            Sessions + stats
/app/profile            Profile & preferences
```

## Data model (Lovable Cloud)

- `profiles` (id → auth.users, display_name, tradition, default_sa, voice_type)
- `lessons` (id, slug, title, tradition, level, category, target_sa, bpm, tala, loop_count, instructions, order_index) — seeded via migration
- `practice_sessions` (id, user_id, started_at, ended_at, duration_sec, lesson_id?, tools jsonb, pitch_stats jsonb)
- `lesson_progress` (user_id, lesson_id, completed_at, times_practiced) — unique(user_id, lesson_id)
- `user_settings` (user_id, default_sa, default_bpm, default_tala, theme)

All tables: GRANTs for authenticated + service_role, RLS enabled, policies scoped to `auth.uid()`. `lessons` gets `TO anon SELECT` for the public library preview on landing.

## Technical approach

- TanStack Start routes; protected pages under `src/routes/_authenticated/app.*`.
- Audio engine (`src/lib/audio/`):
  - `tanpura.ts` — sampler-style additive synth of tanpura strings (sine + partials, plucked envelope, jhala scheduler using AudioContext lookahead).
  - `tala.ts` — click scheduler with sam/khali/tali accents.
  - `pitch.ts` — AudioWorklet running YIN; posts note+cents to React via message port.
  - `transport.ts` — single shared AudioContext, master gain, start/stop coordination.
- UI state via React + Zustand-lite context; queries via TanStack Query.
- Session logging through `createServerFn` with `requireSupabaseAuth`.
- Mic access gated behind an explicit permission prompt; graceful fallback when denied (tuner shows setup card).
- All audio runs client-side; no server audio processing.

## Build order

1. Auth scaffolding (email + Google), profile table, `_authenticated` layout, landing page.
2. Design system tokens (dark modern-minimal palette, mono numerics), app shell + Today page.
3. Tanpura engine + UI.
4. Tala engine + UI, combined transport with tanpura.
5. Lessons schema + seed (10–15 lessons), library, player embedding tanpura/tala.
6. Pitch detection worklet + Tuner page.
7. Practice session logging, history page with heatmap + streak.
8. Profile/settings, polish, SEO metadata per route.

## Out of scope for v1

Recording playback, sheet notation rendering, social/sharing, teacher mode, offline PWA, mobile native wrappers.
