# Piano Transcriber for iPhone — Requirements

Sep 26, 2026 · @Dorit Z

## Overview and goals

An iPhone companion app for pianists. It helps them decide which songs to learn, plays those songs so they can learn by listening, manages the songs they are learning, keeps a library of every song they have learned, and records their playing and turns it into notes.

The parts work as one loop: the app recommends songs based on the genres the pianist likes; they add the ones they want to their learning list; they listen to the song in the app, then practise and record themselves; and once learned, each song moves into their library with its recordings and notes attached.

Transcription runs on the phone, so recording and converting to notes work offline. Recommendations use an online song catalog.

**v1 success criteria**

- After choosing genres, the user sees at least 10 song recommendations, and at least half of them are marked "want to learn" or "already know" in user testing.
- A song moves from recommended to learning to learned in one tap per step, and the learning list and library show every song's status at a glance.
- A 60-second recording is transcribed in under 15 seconds on an iPhone 13 or newer.
- On clean recordings of intermediate-level repertoire, at least 85% of notes are detected with the correct pitch and onset (note-level F1 against a MIDI ground truth).
- The resulting score is readable without editing for simple pieces (hymns, beginner method books, pop chord accompaniments).
- Recording, transcription and the song library work with airplane mode on; recommendations need a connection.

## Users and use cases

The primary user is a hobbyist or student pianist who can play but finds writing notation slow.

- As a pianist, I want to tell the app which genres I like and get recommendations for songs to learn to play.
- As a pianist, I want a list of the songs I'm learning, so I can listen to them while I'm learning them.
- As a pianist, I want to record an idea I just improvised, or myself playing a song I'm learning.
- As a pianist, I want the system to convert this recording to notes.
- As a pianist, I want a library of the songs I've learned and recorded, with their recordings and notes.

## Functional requirements

The app has six feature areas; IDs let each requirement be tracked and tested.

**Recording**

- **FR-1** Record from the built-in mic or a connected USB/Bluetooth mic at 44.1 or 48 kHz mono.
- **FR-2** Show a live input level meter and warn if the input is too quiet or clipping.
- **FR-3** Support recordings up to 10 minutes; keep recording if the screen locks.
- **FR-4** Optional 4-beat count-in with metronome clicks at a user-set tempo (40–200 BPM), heard only in headphones or excluded from transcription.
- **FR-5** Import audio files (m4a, wav, mp3, aiff) from Files and the share sheet.

**Transcription**

- **FR-6** Convert audio to a list of notes (pitch A0–C8, onset, offset, velocity) with a polyphonic, piano-specific model running on-device.
- **FR-7** Detect sustain pedal presses and use them to extend note durations.
- **FR-8** Show progress while processing; allow cancel.

**Score generation**

- **FR-9** Estimate tempo and beat positions; the user can override tempo and time signature (2/4, 3/4, 4/4, 6/8 in v1).
- **FR-10** Quantize notes to a user-selectable grid (quarter, eighth, sixteenth, triplets on/off).
- **FR-11** Estimate the key signature; the user can override it.
- **FR-12** Split notes into treble and bass staves (default split at middle C, with a smarter hand-assignment heuristic).
- **FR-13** Produce correct note spelling (e.g. F♯ vs G♭) from the key, and add rests, ties and beams.

**Viewing and playback**

- **FR-14** Render the score as engraved notation, scrollable and zoomable, in portrait and landscape.
- **FR-15** Play back the transcription with a built-in piano sound, highlighting the current note.
- **FR-16** Toggle A/B between the original recording and the synthesized playback.
- **FR-17** Show an optional piano-roll view alongside the score.

**Editing**

- **FR-18** Tap a note to change its pitch, duration, or delete it; add notes and rests.
- **FR-19** Change tempo, time signature, key and quantization and re-generate the score without re-running the model.
- **FR-20** Undo/redo for all edits.

**Library and export**

- **FR-21** Save each project (audio, raw notes, edits, score) locally with title and date; rename, duplicate, delete, search.
- **FR-22** Export MIDI (.mid), MusicXML (.musicxml) and PDF via the iOS share sheet.
- **FR-23** Optional sync through the user's iCloud Drive (no custom backend).

**Song recommendations**

- **FR-24** Let the user pick the genres they like (e.g. pop, classical, jazz, film/TV, rock, R&B, worship) and change them at any time.
- **FR-25** Recommend songs to learn that match the chosen genres, each showing title, artist/composer, genre and difficulty level.
- **FR-26** Let the user mark a recommendation as "want to learn", "not interested" or "already know", and use that feedback to improve later recommendations.
- **FR-27** Recommendations come from an online song catalog, so they stay current and cover a wide range of songs. With the user's permission, the app can also use their Apple Music listening history to improve them. The latest recommendations stay viewable offline.
- **FR-28** Link a recommendation to the user's own recordings, so once they record themselves playing it, it moves into their song list.

**Song playback**

- **FR-29** Play the original recording of any recommended, learning or learned song from inside the app, through Apple Music.
- **FR-30** Apple Music subscribers hear the full song; others hear a 30-second preview, with a prompt to open the song in Apple Music.
- **FR-31** Standard controls: play/pause, scrub, and skip back a few seconds to replay a passage.
- **FR-32** On a song's page, switch between the original song, the user's own recordings of it, and the playback of their transcribed notes.

**Learning list and library**

- **FR-33** Keep a learning list: add songs from recommendations or by searching the catalog. Each song shows title, artist, date added and how many times the user has recorded it.
- **FR-34** Play any song on the learning list in one tap, with a repeat option so it can play on a loop while the user practises.
- **FR-35** Attach recordings to a song on the learning list, so the user can compare their playing with the original.
- **FR-36** Mark a song as learned to move it into the library, keeping its recordings, notes and link to the original song.
- **FR-37** The library holds learned songs and improvised recordings, each with its recordings and notes; searchable and sortable by title, date or genre.

## Non-functional requirements

The hard constraints are offline operation and on-device processing fast enough to feel instant.

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-1 | Offline | Recording, transcription, playback, editing and the song list work without a network. Recommendations and iCloud sync need a connection. |
| NFR-2 | Privacy | Audio never leaves the device except when the user exports or enables iCloud. No analytics on audio content; only genre choices and recommendation feedback go to the recommendation service. Mic permission requested with a clear purpose string. |
| NFR-3 | Speed | Transcription at ≥ 4× real time on iPhone 13 (A15) and newer; score re-generation after an edit in < 300 ms. |
| NFR-4 | Accuracy | Note-level F1 ≥ 0.85 (onset ±50 ms) on the internal test set of phone recordings; ≥ 0.90 on MAESTRO-style clean audio. |
| NFR-5 | Device support | iOS 17+, iPhone only in v1 (iPad layout later). Minimum device: iPhone 12. |
| NFR-6 | Resources | App download ≤ 150 MB; peak memory during transcription ≤ 500 MB; no thermal throttling on a 10-minute file. |
| NFR-7 | Battery | Processing a 5-minute recording uses < 2% battery on iPhone 13. |
| NFR-8 | Reliability | Recordings are saved to disk continuously so a crash or call interruption never loses audio. |
| NFR-9 | Accessibility | Dynamic Type, VoiceOver labels on all controls, sufficient contrast in light and dark mode. |

## Technical approach

Build a native Swift/SwiftUI app with a Core ML piano-transcription model and a rule-based score engine. Transcription runs locally; a small online service provides song recommendations.

| Stage | Component | Notes |
| --- | --- | --- |
| 1. Capture | AVAudioEngine | Record to disk as 16-bit PCM; resample to the model's rate (16 kHz for most transcription models). |
| 2. Transcription | Core ML model on the Neural Engine | Candidates: ByteDance high-resolution piano transcription (best piano accuracy, pedal output), Google Magenta Onsets and Frames, or Spotify Basic Pitch (smallest, general-purpose). Convert with coremltools, quantize weights to 8-bit, run in overlapping \~10 s chunks. |
| 3. Note events | Swift post-processing | Peak-pick onset/frame outputs into notes with pitch, onset, offset, velocity; apply pedal to extend durations. |
| 4. Rhythm | Beat tracking + quantizer | Tempo/beat estimate from onsets (or the count-in tempo when used), then snap to the chosen grid. |
| 5. Score | Notation model | Key estimation (Krumhansl-style profiles), hand split, note spelling, ties, rests, beaming → MusicXML. |
| 6. Render | Verovio (C++, runs natively) or OpenSheetMusicDisplay in an offline WKWebView | Both render MusicXML to engraved SVG; check licences before choosing. |
| 7. Playback | AVAudioUnitSampler + a bundled piano SoundFont | Plays the note list; drives the note-highlight cursor. |
| 8. Storage | SwiftData + app documents folder | One folder per project: audio, notes JSON, edits, MusicXML. |

**Model selection plan.** Benchmark 2–3 candidate models on a test set of 30+ real iPhone recordings (different pianos, rooms, phone positions) with MIDI ground truth captured from a digital piano. Pick on accuracy, speed and size together; fine-tune on phone-recorded audio if accuracy falls short of NFR-4.

**Recommendations.** A lightweight backend holds a song catalog tagged with genre and piano difficulty, and returns ranked suggestions from the user's genres and feedback. Apple MusicKit can supply catalog data and, with permission, listening history and in-app playback (full songs for subscribers, 30-second previews otherwise). Difficulty ratings need their own source, such as manual curation to start.

## Out of scope for v1

These are deliberately deferred to keep v1 small and focused.

- Live note display while playing (v2).
- Instruments other than piano, and piano with singing or other instruments in the mix.
- Android, iPad-optimized layout, Mac.
- Cloud transcription and user accounts (the recommendation service works without sign-in).
- Dynamics markings, articulations, ornaments, and tempo changes within a piece.
- Complex meters (5/4, 7/8) and tuplets beyond triplets.
- Chord symbols and lead-sheet output.
- Direct MIDI input from a digital piano (easy to add later; bypasses transcription entirely).

## Milestones

Four phases, each ending in something testable on a real iPhone; durations assume one developer.

| Phase | Scope | Exit criteria | Estimate |
| --- | --- | --- | --- |
| 1. Model spike | Convert 2–3 candidate models to Core ML; build test set; benchmark | One model meets NFR-3 and NFR-4 on device | 2–3 weeks |
| 2. Core pipeline | Record → transcribe → piano roll + playback (FR-1–8, FR-15) | 60 s recording shows correct piano roll offline | 3 weeks |
| 3. Notation | Quantize, key, hand split, MusicXML, rendering (FR-9–14, FR-17) | Simple pieces render readable without edits | 4 weeks |
| 4. Editing and ship | Editing, library, export, polish, accessibility, TestFlight (FR-16, FR-18–23) | Beta testers complete record → edit → export unaided | 4 weeks |

## Risks and open questions

The biggest risk is that phone-mic recordings in real rooms transcribe worse than the studio audio the models were trained on.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Accuracy drops on phone mics, upright pianos, reverberant rooms | Messy scores, users lose trust | Test set of real phone recordings from day one; fine-tune on augmented audio (room reverb, mic EQ, noise) |
| Rhythm quantization makes rubato or swing unreadable | Correct notes, unreadable rhythm | Count-in/metronome option; easy tempo and grid overrides; A/B playback |
| Model too large or slow for older iPhones | Misses NFR-3, NFR-6 | 8-bit weight quantization; chunked inference; raise minimum device if needed |
| Training data licences | May block commercial release | The common piano dataset (MAESTRO) is licensed for non-commercial use; confirm the licence of any pre-trained weights and any fine-tuning data before launch |
| Rendering library licence | Copyleft obligations | Review Verovio (LGPL) vs OpenSheetMusicDisplay (BSD) terms early |

**Open questions**

- [ ] Free app, paid app, or free with a paid tier (e.g. PDF export, longer recordings)?
- [ ] Should v1 include direct MIDI input from digital pianos, since it's cheap and perfectly accurate?
- [ ] Is live (while-playing) display important enough to pull into v1?
- [ ] Target skill level: beginner pieces only, or intermediate classical and pop too?
- [ ] Recommendations: where do piano difficulty ratings come from — manual curation, a licensed data source, or estimated automatically?
- [ ] Recommendations: should the app also provide sheet music for recommended songs? Copyrighted songs would need licensing, so v1 may only suggest titles, or offer public-domain pieces.
