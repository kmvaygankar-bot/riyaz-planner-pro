## Scope
Four focused changes across Lessons and Studio. No DB or auth work.

## 1. Lesson page — BPM selector
File: `src/routes/_authenticated/app.lessons.$slug.tsx`

- Add a BPM slider (range 40–120, step 2, default from lesson or 60) shown before Play.
- Disable while sequence is playing.
- Pass the selected BPM into `startHarmoniumSequence({ bpm })`.
- Persist last-used BPM per lesson in `localStorage` (`riyaz:lesson-bpm:<slug>`).

## 2. Studio — sing along with uploaded song, then playback recording
Files: `src/routes/_authenticated/app.studio.tsx`, new `src/lib/audio/recorder.ts`

### Playback of uploaded song while singing
- Decode the uploaded `File` once (already done during analyze) and keep the `AudioBuffer` in a ref.
- On "Start riyaz":
  - Route mic through `getUserMedia` → `MediaStreamAudioSourceNode` → `MediaStreamDestination` (recorded stream only; nothing sent to speakers, prevents echo).
  - Simultaneously play the decoded song via an `AudioBufferSourceNode` connected to `audioCtx.destination` so the user hears the track but the mic recording does NOT include it.
  - Pitch detection continues to run on the mic stream for the live target/you display and report.
- Keep the existing harmonium guide OFF by default when a song is loaded (song IS the guide). Small toggle "Also play harmonium guide" — off by default.

### Recording the user's voice
- New `src/lib/audio/recorder.ts` wrapping `MediaRecorder` on the mic-only `MediaStream`.
  - Mime: prefer `audio/webm;codecs=opus`, fallback `audio/mp4`.
  - Collect chunks, expose `stop()` returning a `Blob` + object URL + duration.
- Stored on state as `{ blob, url, mime }` after Stop.

### Post-stop playback (voice only, no background)
- After Stop, the Studio "Riyaz along" card shows a new "Your recording" section:
  - `<audio controls src={url}>` — plays voice only (background song is not mixed in).
  - "Play" and "Stop" buttons already covered by native controls.
- The uploaded song does NOT auto-play here.

### Save to local system
- "Download recording" button → creates an `<a download>` with filename `riyaz-<yyyymmdd-hhmm>.webm` (or `.m4a` if fallback) and clicks it programmatically.
- Cleans up `URL.revokeObjectURL` on unmount / reset.

## 3. Studio — Reset button
- Prominent "Reset" button in the Studio header/actions area.
- Clears: `file`, `result`, `report`, `elapsed`, `liveNote`, `liveCents`, `expectedNote`, recording state, and any refs (`seqRef`, `pitchRef`, recorder).
- Stops any active playback / mic / sequence first.
- Revokes recording object URL.
- Returns UI to the initial "Upload song" state so a new file can be uploaded.

## 4. UX flow after these changes
```text
Upload  →  Analyze  →  [BPM optional] Sing-along (song plays, mic records)
        →  Stop  →  Report + Your recording (voice only) + Download
        →  Reset  →  back to Upload
```

## Technical notes
- Recording pipeline uses a dedicated `MediaStreamDestination` fed only by the mic source, so the uploaded song never enters the recorded blob even though the user hears it.
- Uploaded song plays through `AudioContext.destination`; guide harmonium (if toggled on) shares the same master.
- Everything stays client-side; no schema, no server changes.
- Save to history (existing) is unchanged.

## Out of scope
- Mixing background + voice into the download.
- Cloud storage of recordings.
- Server-side transcoding.
