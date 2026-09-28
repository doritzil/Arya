# Components

Reference for every UI component in the Aria design system. Props are in `component-props.d.ts`; `web-reference-bundle.js/.css` is the working web implementation used by the prototype (React) — use it as the behavioural and visual reference when building the SwiftUI versions.


---

# Button

Pill buttons for every labelled action.

- `variant`: **primary** (the dark pill, one per screen: the next step in the loop — Want to learn, Record, Mark as learned), **secondary** (glass with a `line-strong` border), **soft** (a light `primary-soft` fill with `ink` text: the main action inside a card, e.g. Want to learn on a song card), **ghost** (low-stakes text: Cancel, Not now).
- `size`: default 52pt tall; `small` 40pt inside cards. Touch targets never go under 44pt.
- `icon` optional, leading. Labels are verbs in sentence case, 1–3 words.
- Put secondary buttons on glass or solid ground, not on the bare gradient.


---

# Difficulty

Piano difficulty: 1–5 dots plus the level word (FR-25).

- `level`: 1 Beginner · 2 Easy · 3 Intermediate · 4 Advanced · 5 Expert.
- Dots are `accent`; the word is `ink-muted`. VoiceOver reads "Difficulty: Intermediate".


---

# FallingKeys

Keyboard mode: the song's notes fall onto a piano keyboard, and each key lights up while its note sounds, so she can see exactly which keys to play.

- Props: `notes` `[{p: MIDI pitch, t: start beat, d: beats, hand: 'L'|'R'}]`, `now` (current beat, drives the fall), `span` (beats visible above the keys, default 4), `low`/`high` (range, default C3–E5), `height`, `labels` (C labels on the keys, default on).
- Right hand is **peach**, left hand is **orchid**. Lit keys also show the note name, so hands and notes never rely on colour alone.
- Used full-screen in landscape (see the Keyboard mode screen), on the dark theme for focus. The notes come from her transcription (My notes) or, where available, the song's own note data.


---

# GenreChip

Toggle chips for picking liked genres (FR-24).

- Props: `selected`, `onClick`, children = genre name.
- Selected is the dark `primary` pill with a check icon; unselected is glass with a `line-strong` border. The check means it never relies on color alone.
- Wrap in a row with `space-2` gaps. Ask for at least 3 on first run; editable from Discover any time.


---

# Icon

Soft two-tone icons from **Phosphor Icons** (MIT licence, phosphoricons.com), drawn in `currentColor` on a 256 grid.

- Props: `name`, `size` (default 24), `weight` (`duotone` default, or `fill`), `label` (makes it a VoiceOver image; omit when the button already has an `aria-label`).
- Names: `play`, `pause`, `next`, `back`, `chevron-left`, `chevron-right`, `heart`, `timer`, `repeat`, `shuffle`, `mic`, `record`, `sliders`, `metronome`, `speed`, `note`, `check`, `close`, `plus`, `discover`, `learning`, `library`, `alert`, `wave`, `search`, `piano`, `headphones`, `share`, `star`, `settings`, `more`, `sort`, `export`, `trash`, `pencil`, `undo`, `minus`, `redo`, `up`, `down`, `file`, `cloud`, `import`.
- **Duotone** is the house style: an outline with a soft tint layer. The tint is 20% of the icon colour, and turns **peach** inside icon tiles, active tabs, player side controls and pressed icon buttons.
- Simple glyphs (check, close, plus, minus, chevrons, up, down, more, undo, redo, sort) use Phosphor's **bold** outline in place of duotone, since a tint layer behind them reads as a box.
- **Fill** is for solid marks: play, pause, next and record are always fill; the selected tab and a pressed heart switch to fill.
- Icons take `ink` or `ink-muted`; inside icon tiles `accent`. Never emoji.
- In the iOS app, ship the same Phosphor icons (Phosphor has a Swift package) so the app matches these designs; don't mix in SF Symbols.


---

# IconButton

Round glass button for icon-only actions: back, favourite, open the practice mix, repeat.

- Props: `icon`, `label` (required — it's the VoiceOver name), `pressed` for toggles, `size` (`small` = 40pt), `glass` (false inside a card that's already glass).
- Sits in the top corners of a screen, like the back and heart buttons in the now-playing screen.


---

# LevelMeter

Live mic input level with too-quiet / clipping warnings (FR-2).

- Props: `level` 0–1, `warning`: `quiet` | `clipping` | none.
- Bars fill in `accent`; the top segments turn `warning`. A warning always shows the icon and a sentence that says what to do.


---

# NowPlaying

The full-screen player on a song's page (FR-29–31, FR-34): it sits straight on the gradient, like the inspiration.

- Props: `eyebrow`, `title`, `subtitle`, `position` / `duration` (seconds), `playing`, `loop`, `preview`, `seed`.
- Layout, top to bottom: eyebrow → `hero` title → subtitle → waveform → scrubber with times → Loop · play disc · Back 5s.
- `preview` adds the 30-second notice with the Apple Music prompt (FR-30).
- One per screen. Put the Practice mix or the source switch on a glass card below it.


---

# PianoRoll

Piano-roll view of transcribed notes beside the score (FR-17), with the playing note highlighted (FR-15).

- Props: `notes` `[{p: MIDI pitch, t: start beat, d: beats}]`, `low`/`high` pitch range, `beats` in view (default 8), `current` index.
- Notes are `note` (orchid) at half strength; the current note glows in the peach→orchid gradient. C keys are labelled (C4 = middle C).


---

# PlayerBar

Compact glass player that floats above the tab bar while browsing.

- Props: `title`, `artist`, `position`, `duration`, `playing`, `repeat`, `preview`.
- Tapping it opens NowPlaying. The thin progress line uses the peach→orchid gradient.


---

# RecordButton

The one big record control (FR-1, FR-3, FR-4).

- Props: `recording`, `time` (mm:ss, in `numeral`), `hint`, `onClick`.
- Idle: mic on a `record` disc with a glass halo. Recording: stop square, so the state is shown by shape, not only color.
- The only place `record` is used. Reassure under it: "saved as you play" (NFR-8).


---

# Score

The transcription as engraved notation on a grand staff: treble and bass clefs, key signature, time signature, bar lines, note heads, stems, flags and ledger lines (FR-12–FR-15).

- Props: `notes` `[{n: 'Ab4', t: beat, d: beats, staff: 'treble'|'bass'}]` (spelled from the key, FR-13), `beats` in view, `flats` in the key signature (D♭ major = 5), `time` (`'4/4'`, `'3/4'`…), `current` (index of the note playing, glows `accent`, FR-15), `selected` (index being edited, ringed in `accent-soft`, FR-18).
- Durations drawn: half (hollow), quarter, eighth (flag). Clefs and flats use the Noto Music font.
- Always on a glass card. In the app, the real engraving comes from the notation renderer (Verovio / OSMD); this component is the design reference for colours and states.


---

# SliderRow

An icon tile, a label, a peach→orchid slider and its value — the "Make it yours" pattern from the inspiration.

- Props: `icon`, `label` (one word), `value`, `min`/`max` (default 0–100), `unit`.
- Use it for settings like count-in tempo (40–200 BPM, FR-4). The song page no longer has a Practice mix card; speed lives in Keyboard mode.
- Always show the number.


---

# SongCard

One song on a glass card, wherever it appears: recommendations, learning list, library.

- Props: `title`, `artist`, `genre`, `level` (1–5), `status`, `variant` (`recommendation` adds Want to learn and Not interested), `footnote` (date added · number of takes, FR-33), `playing`, `progress` (0–1), `repeat`, `onPlay`, `onRepeat`.
- No art tile: the title leads. Song cards stay light: the play button is a soft glass disc and Want to learn uses the `soft` button, so the dark `primary` is saved for a screen's one main action.
- Playing happens in place: tapping play turns that card's disc into a pause button and the card stays where it is — no separate mini player on Discover. Only one card plays at a time.
- The play disc plays the original in one tap (FR-34). Tapping elsewhere opens the song.
- Recommendations show no status pill (no "For you"): just the difficulty. Learning and learned songs show their pill.
- `wanted`, `onWant`, `onDismiss`: Want to learn turns into "Added to Learning" with a check once tapped; ✕ removes the card from the list (and counts as "not interested" feedback, FR-26).
- Recommendation actions: **Want to learn** (soft button) · ✕ Not interested (icon button). There's no "I know it" button on the card.

- `action`: `play` (default) plays the song in place — used on Discover, where the card never navigates. `open` swaps the play button for a chevron — used on the Learning list, where the whole card is a link to the song page (play, loop, keyboard mode live there).
- A playing card with `play` action also shows a thin progress line and a **repeat** toggle, so the song can loop while she practises (FR-34), when a list plays in place.


---

# SourceSwitch

Segmented pill on the song page: **Original · Recordings · My notes** (FR-32). Also used for A/B: **Recording · Piano** (FR-16).

- Props: `options` (2–3 short labels), `value` (index), `onChange`.
- Selected option is the dark `primary` pill on a glass track.


---

# StatusPill

Where a song is in the loop, at a glance.

- `status`: `recommended` (For you — not shown on recommendation cards), `learning`, `learned` (with check), `idea` (an improvised recording, with wave icon).
- Always a word, never a bare dot. One pill per song.


---

# TabBar

The app's four places, matching the loop: **Discover → Learning → Record → Library**.

- Prop: `active` (`discover` | `learning` | `record` | `library`).
- Frosted `glass-strong` bar. Selected tab: `accent` icon and `ink` label; others `ink-muted`. Labels always visible.


---

# TranscribeProgress

Glass card showing progress while a recording turns into notes, with Cancel (FR-8).

- Props: `progress` 0–1, `stage` ("Listening for notes…", "Finding the beat…", "Writing the score…").
- Always says it runs on the phone and works offline (NFR-1, NFR-2).


---

# Waveform

The glowing bar waveform — the app's signature image, straight from the inspiration.

- Props: `progress` 0–1 (played part glows at full strength, the rest at half), `height`, `bars` (default 56), `seed` (changes the shape per song), `label`.
- Draw it in `wave` directly on the gradient, never on a solid card. In the app it's built from the real audio's loudness.
- Use it on the now-playing hero and while recording. Not in lists.
