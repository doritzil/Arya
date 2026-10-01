# Aria — development guide

How to run the app, what's real and what's mocked, and what's left. The design is in
[`ARCHITECTURE.md`](ARCHITECTURE.md); the screens are in [`design-handoff/`](design-handoff/README.md).

## Setup

```bash
pnpm install
pnpm test          # score engine + app tests (Jest)
pnpm typecheck     # tsc --noEmit
```

Expo SDK 57 · React Native 0.86 (New Architecture) · Expo Router · TypeScript strict · pnpm workspace.

## Running it

### On an iPhone (the real app)

Aria has custom native code, so it needs a **development build** (Expo Go won't work).

- **With a Mac:** `npx expo run:ios --device` (needs Xcode 16+, CocoaPods).
- **Without a Mac:** `npx eas-cli@latest build --profile development --platform ios`, install it on the phone, then `npx expo start`.

First run on a device will be the first time the Swift in `modules/` is compiled — see *Known gaps*.

### In a browser (design preview)

```bash
npx expo start --web
```

Open `http://localhost:8081/?demo` to start with the sample songs and takes from the designs (without `?demo` you
get a fresh install and onboarding). Every native module falls back to a JS mock on web:

| Module | Mock behaviour |
|---|---|
| `aria-audio` | Mic permission granted; realistic level meter with occasional "too quiet"; a player clock that honours loop/rate/seek. **Apple Music previews play real audio** (through expo-audio, which Expo Go includes); recordings and the piano are silent |
| `aria-transcriber` | "Transcribes" any take in ~4 s into an 8-bar C-major demo piece |
| `aria-musickit` | Not used for playback — without the native module, songs play the 30-second preview. The Apple Music toggle explains it can't connect |
| `aria-icloud` | Unavailable |

The web preview is for layout and flows only — it is not a shipping target.

## Layout

```
src/app/            routes (Expo Router) — thin
  (onboarding)/     welcome → how-it-works → genres → level → microphone → first-songs
  (tabs)/           discover · learning ([songId] = song page) · record ([projectId] = Your notes) · library
  take/             new → name-idea → get-ready → recording → transcribing   (full-screen, no tab bar)
  keyboard/[source] Keyboard mode — source = score:<songId> | project:<projectId>
  edit/[projectId]  Edit a note
  sheets/           edit-genres · how-its-written · share
src/features/       per-feature components + logic (discover, learning, record, notes, keyboard, onboarding)
src/ui/             design-system components (COMPONENTS.md), icons, theme-aware primitives
src/theme/          tokens (generated), fonts, ThemeProvider
src/data/           types, Zustand store, repos (memory / SQLite), project folders, seed catalog
src/playback/       PlaybackCoordinator + UI-thread visual clock
src/services/       recommendation ranking (runs locally on the seed catalog until reco-api exists)
modules/            aria-audio · aria-transcriber · aria-musickit · aria-icloud (Swift + TS + JS mock)
packages/score-engine   raw notes → score, MEI, MusicXML, MIDI, falling notes (pure TS, 57 tests)
plugins/            config plugins (Info.plist, background modes, document types, MusicKit, iCloud)
scripts/            gen-tokens.mjs (tokens.json → TS), gen-icons.mjs (Phosphor → path data)
```

Generated files — don't edit by hand: `src/theme/tokens.generated.ts` (`pnpm gen:tokens`),
`src/ui/icons.generated.ts` (`pnpm gen:icons`).

## Where the build differs from ARCHITECTURE.md

| Spec | Built | Why |
|---|---|---|
| Routes in `app/` | `src/app/` | SDK 57 template default |
| Skia for waveform / meter / piano roll / falling keys (D7) | Plain views; Keyboard mode translates one pre-laid-out note field on the UI thread with Reanimated | Same "move a picture, don't redraw" idea without a 6 MB native dependency. Revisit only if profiling on iPhone 12 says so. |
| `phosphor-react-native` | Icon paths generated from `@phosphor-icons/core` into `icons.generated.ts`, rendered with `react-native-svg` | The RN package ships untyped source and every icon; generated paths are exact, typed and tiny |
| TanStack Query for reco-api | Not used yet | No backend yet — recommendations are ranked on device from `seedCatalog.ts` with the §9.1 ranking |
| Keyboard mode "Original" | `score` state, labelled **"Score · piano"** / "Watch the piece fall onto the keys" | Curated MIDI plays through the built-in piano, not the Apple Music recording — naming it "Original" would promise the wrong audio (design review, Sep 28) |
| Locked Keyboard mode row: lock icon | Mic icon | A lock reads as a paywall; the row's action is "record" |

## Known gaps (next steps, roughly in order)

1. **Compile on a Mac.** None of the Swift has been compiled yet. Expect a round of fixes in `modules/*/ios`.
   Things flagged for on-device checks: `hostTime` vs `performance.now()` timebase (fallback: `wallTime`),
   Core ML compute units in the background, `.allowBluetooth` deprecation in the iOS 26 SDK, MusicKit state observation.
2. **Transcription quality.** The bundled model is Spotify's **Basic Pitch** (Apache-2.0, `modules/aria-transcriber/ios/Model/`,
   adapter `BasicPitchModel.swift`). It's general-purpose, not piano-specific: no velocity or pedal heads, and it
   hears piano overtones as quiet octave notes (filtered in post-processing). Checked offline against the same
   network in ONNX: chunk stitching is frame-exact and note starts land within ~20 ms. A piano-specific model
   (ByteDance / Onsets & Frames, §7.1) can replace it behind `TranscriptionModel` later. The files ship as a pod
   resource bundle and are compiled on device on first use (so no `withModelAsset` plugin is needed).
3. **Bundle a piano SoundFont** (`AriaPiano.sf2`, ≤ 25 MB, permissive licence) — synth playback is silent without it.
4. **Licence gates:** Verovio (LGPL-3.0, used in `ScoreView`) is still open. Basic Pitch is Apache-2.0: its
   LICENSE and NOTICE ship in the model bundle and need to appear in an in-app Acknowledgements screen.
5. **Curated MIDI** for public-domain pieces (`catalog-midi/*.mid`) + a MIDI → RawNotes reader; until then
   Keyboard mode's "score" source uses a generated demo piece.
6. **reco-api** (Cloudflare Worker + D1, §9): catalog, Apple Music IDs, feedback outbox flush. Until then the app
   uses Apple's public iTunes Search API (`src/services/appleMusic.ts`) for preview URLs and IDs, and Discover
   search shows the whole Apple Music catalog below the 71 rated seed songs. Those songs have no difficulty
   ("Level not rated yet") until reco-api can rate them.
7. **Apple Music full playback** is routed (subscribers + permission + dev build → MusicKit; everyone else → preview)
   but untested on a device.
8. **Not designed yet:** Library (built from existing patterns), Settings, rename/duplicate/delete takes, empty and
   error states beyond the basics.
9. **iCloud sync** — skeleton only; off by default.
10. **E2E tests** (Maestro) once a dev build exists.
