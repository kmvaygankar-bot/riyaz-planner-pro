
## Overview

Three coordinated changes:

1. **New "Riyaz Studio" page** — upload a song (≤3 min), analyze the pitches used, get a detected sargam/alankar pattern, practice along, then receive a report.
2. **Fix alankar lesson content** — replace the current patterns with the standard Hindustani alankars used in real riyaz (sa re ga ma pa dha ni sa, sa sa re re ga ga…, etc.).
3. **Fix lesson playback** — the harmonium in a lesson currently only holds one drone chord. It should actually play the lesson's notes in aaroh (ascending) then avroh (descending) as a guide track, while continuing to give a Sa reference.

---

## 1. Riyaz Studio (new page)

New route: `src/routes/_authenticated/app.studio.tsx` at path `/app/studio`. Added to the app shell nav ("Studio"). Icon: `Wand2` or `AudioLines`.

Flow, top → bottom on one screen:

```text
┌───────────────────────────────────────┐
│ 1. Upload song  (mp3/wav/m4a, ≤3 min) │
│    [ Choose file ]   or drag-and-drop │
│    Sa: [C ▼]  (defaults to profile)   │
├───────────────────────────────────────┤
│ 2. Analyze                            │
│    [ Analyze song ]  → progress bar   │
│    Result:                            │
│      Detected Sa: C                   │
│      Notes used:  S R G M P D N Ṡ     │
│      Pattern:     S R G M | M G R S   │
│      Likely raag hint: Bilawal / —    │
├───────────────────────────────────────┤
│ 3. Riyaz along                        │
│    ▶ Play guide (harmonium plays      │
│      detected pattern aaroh + avroh   │
│      while your mic captures pitch)   │
│    Live pitch bar + target note       │
├───────────────────────────────────────┤
│ 4. Report                             │
│    Accuracy: 78%                      │
│    In-tune time: 2m 14s / 3m 00s      │
│    Notes hit:   S R G M P             │
│    Notes missed: D N                  │
│    Weakest note: G  (avg -22 cents)   │
│    [ Save to history ] [ Try again ]  │
└───────────────────────────────────────┘
```

### Constraints & validation

- Client-side check: file size ≤ 15 MB and decoded duration ≤ 180 s. Reject with a toast if longer.
- Audio stays in the browser — decoded via `AudioContext.decodeAudioData`. No upload to server, no storage bucket needed.

### Analyzer

New module `src/lib/audio/analyze.ts`:

- Decode the file to a mono `Float32Array` at 22050 Hz (downmix + resample).
- Slide a 2048-sample window with 50% hop; run the same autocorrelation used in `pitch.ts` on each frame.
- For each frame with a valid pitch, map frequency → nearest semitone relative to chosen Sa → scale degree (S, r, R, g, G, m, M, P, d, D, n, N, Ṡ).
- Aggregate:
  - `notesUsed`: set of scale degrees appearing in ≥ ~1.5% of voiced frames.
  - `pattern`: run-length compressed sequence of dominant note per ~200 ms segment (capped to first ~32 tokens for display).
  - `saSuggestion`: histogram peak — offered as "detected Sa" if it differs from the chosen one.
  - `raagHint`: lightweight lookup — match `notesUsed` against a small built-in table (Bilawal, Yaman, Bhairav, Kafi, Bhairavi, Khamaj). Purely a hint; shown only when confident.

Runs entirely on the main thread inside a `requestIdleCallback`/chunked loop so a 3-min clip stays responsive; progress reported 0–100%.

### Play-along + report

- "Play guide" reuses the existing harmonium engine (see change 3) plus the tala engine off, feeding it `notesUsed` in aaroh then avroh at a user-adjustable BPM.
- Simultaneously calls `startPitch()` and, per frame, compares detected note vs the current expected note in the guide sequence.
- Tracks: total voiced time, in-tune time (|cents| ≤ 25 against expected note), per-note hit counts and average cents deviation.
- On stop → renders the report card. "Save to history" calls `logPracticeSession` (server fn already exists) with `tools: { studio: true, notes_used, accuracy_pct }` and duration.

### File not analyzed / errors

- Unsupported codec, >3 min, or decode failure → inline error card, no crash.

---

## 2. Correct the alankar lesson content

Replace the seeded rows in `lessons` with the standard set used in classical riyaz. All target `Sa` stays user-configurable; patterns are shown as scale degrees so they render for both Hindustani and Carnatic.

### Basic Alankars (each: aaroh row + avroh row, 3 min target, 60 bpm)

1. Sargam plain — `S R G M P D N Ṡ` / `Ṡ N D P M G R S`
2. Pairs — `SS RR GG MM PP DD NN ṠṠ` / `ṠṠ NN DD PP MM GG RR SS`
3. Triplets — `SRG RGM GMP MPD PDN DNṠ` / `ṠND NDP DPM PMG MGR GRS`
4. Groups of 4 — `SRGM RGMP GMPD MPDN PDNṠ` / `ṠNDP NDPM DPMG PMGR MGRS`
5. Turn (sa re sa) — `SRS RGR GMG MPM PDP DND NṠN` / `ṠNṠ NDN DPD PMP MGM GRG RSR`
6. "Sa sa re, re re ga…" — `SSR RRG GGM MMP PPD DDN NNṠ` / `ṠṠN NND DDP PPM MMG GGR RRS`

### Advanced Alankars (each: aaroh + avroh, 3 min target, 72 bpm)

7. Zigzag 3-back — `SRGRS RGMGR GMPMG MPDPM PDNDP DNṠND` / `ṠNDNṠ NDPDN DPMPD PMGMP MGRGM GRSRG`
8. Zigzag 5-back — `SRGMP RGMPD GMPDN MPDNṠ` / `ṠNDPM NDPMG DPMGR PMGRS`
9. Fourths — `SM RP GD MN PṠ` / `ṠP ND MG PR MS` *(re-verified spelling on write)*
10. Fifths — `SP RD GN MṠ` / `ṠM ND PG DR`
11. Skip-3 — `SG RM GP MD PN DṠ` / `ṠD NP DM PG MR GS`
12. Meend pairs — `S~R R~G G~M M~P P~D D~N N~Ṡ` / `Ṡ~N N~D D~P P~M M~G G~R R~S` (tilde = glide)
13. Palta 1 — `SRGM GMRS  RGMP MPGR  GMPD PDMG  MPDN DNPM  PDNṠ ṠNDP`
14. Palta 2 — `SGRM GRSG  RMGP MGRM  GPMD PMGP  MDPN DPMD  PNDṠ NDPN`

Also keeps the existing meend-only and short taan lessons that were seeded earlier. Everything is one migration + inserts, replacing the old alankar rows by slug so the URLs users already visit keep working where the slug is stable, and pruning obsolete slugs.

Categories used: `Basic Alankar`, `Advanced Alankar`, `Palta`, `Meend`.

---

## 3. Harmonium in lessons plays the lesson's notes

Today `startHarmonium` is a static drone chord. Split it into two use cases:

- **Drone (existing behavior)** — `startHarmoniumDrone(...)` (rename of current function, kept for Tanpura page).
- **Guide sequence (new)** — `startHarmoniumSequence({ sa, notes, bpm, direction: "aaroh" | "avroh" | "both", loop })` in `src/lib/audio/harmonium.ts`.

Guide sequence engine:

- Parses a lesson's `pattern` string into scale-degree tokens (S, r, R, g, G, m, M, P, d, D, n, N, Ṡ, Ṝ, and `~` glides). When `pattern` is empty, falls back to the plain sargam.
- Schedules one reed note per beat at the lesson `bpm`, each ~90% of the beat duration with a short release, using the same reed voicing as the current drone (saw+triangle layers, low-pass, mild tremolo).
- If the token is a glide (`X~Y`), ramps `oscillator.frequency` from X to Y across the beat.
- If `direction === "both"`, plays aaroh (as written), then a short rest, then avroh (reverse), then loops.
- Provides `onStep(cb)` so the lesson page can highlight the current syllable and, later, the Studio page can compare live pitch against the target.

Lesson page (`app.lessons.$slug.tsx`) changes:

- Replace `startHarmonium({ set: "sa-pa" })` with `startHarmoniumSequence({ sa: lesson.target_sa, notes: parsePattern(lesson.pattern), bpm: lesson.bpm, direction: "both", loop: true })`.
- Show the current syllable highlighted inside the existing pattern strip.
- Keep the tala engine wiring unchanged.

Tanpura/drone page keeps calling `startHarmoniumDrone` — no user-visible change there.

---

## Technical section

- **New files**
  - `src/lib/audio/analyze.ts` — decode + pitch histogram + pattern extractor + raag hint.
  - `src/routes/_authenticated/app.studio.tsx` — Studio page.
- **Changed files**
  - `src/lib/audio/harmonium.ts` — split into `startHarmoniumDrone` and `startHarmoniumSequence`; add scale-degree → frequency helper and glide support.
  - `src/routes/_authenticated/app.lessons.$slug.tsx` — use sequence engine, highlight active syllable.
  - `src/routes/_authenticated/app.tanpura.tsx` — call `startHarmoniumDrone` (rename only).
  - `src/components/app-shell.tsx` — add Studio nav entry.
- **DB migration**
  - Optional column `lessons.pattern_avroh text` isn't needed — encoding avroh is done at runtime by reversing tokens for symmetric patterns; asymmetric ones stay explicit in `pattern`.
  - Insert/upsert the corrected alankar/palta/meend rows above; delete stale slugs that no longer match.
- **No new tables, buckets, or secrets.** Uploads never leave the browser.
- **Server functions**: reuse `logPracticeSession` for Studio "Save to history".

