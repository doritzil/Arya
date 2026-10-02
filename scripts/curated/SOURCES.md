# Curated scores — sources and licences

Every curated score comes from the [Mutopia Project](https://www.mutopiaproject.org) (public-domain music
typeset in LilyPond). `midi/<catalogId>.mid` was engraved from the source below with LilyPond 2.25.12
(`pip install lilypond`) after `convert-ly`; `build-curated.mjs` turns it into `src/data/curated/<catalogId>.json`.

| Piece | Mutopia source (`ftp/…`) | Licence | Credit |
|---|---|---|---|
| Für Elise | BeethovenLv/WoO59/fur_Elise_WoO59 | Public Domain | |
| Moonlight Sonata, 1st mvt | BeethovenLv/O27/moonlight (moonlight1-let.ly) | CC BY-SA 2.5 | Typeset by Stewart Holmes |
| Clair de Lune | DebussyC/L75/debussy_Ste_Bergamesq_Clair | Public Domain | |
| Arabesque No. 1 | DebussyC/L66/debussy_Arabesque_1 | Public Domain | |
| Nocturne in E-flat, Op. 9 No. 2 | ChopinFF/O9/chopin_nocturne_op9_n2 | CC BY-SA 3.0 | Typeset by Renato Biolcati Rinaldi |
| Prelude in E minor, Op. 28 No. 4 | ChopinFF/O28/Chop-28-4 | Public Domain | |
| Gymnopédie No. 1 | SatieE/gymnopedie_1 | Public Domain | |
| Minuet in G | BachJS/BWVAnh114/anna-magdalena-04 | Public Domain | |
| Maple Leaf Rag | JoplinS/maple | Public Domain | |
| The Entertainer | JoplinS/entertainer | Public Domain | |
| Amazing Grace (New Britain) | Anonymous/new_britain | Public Domain | |

The CC BY-SA files' derived note data (`src/data/curated/moonlight-…json`, `nocturne-…json`) is shared
under the same licence; the app shows each piece's licence and credit under its score.

## Fixes for LilyPond 2.25 (syntax only — no notes changed)

- **Amazing Grace:** `\partcombine` → `\partCombine`.
- **Maple Leaf Rag:** removed `system-system-spacing #'padding = #8` (page layout); `\applyMusic #unfold-repeats` → `\unfoldRepeats`.
- **Nocturne:** `\override TextSpanner #'bound-details #'left #'text` → `\override TextSpanner.bound-details.left.text`;
  `\note #"8" #1` → `\note {8} #1`; articulation `-|` → `-!`.
- **Moonlight:** `override-auto-beam-setting` (beaming only) errors are harmless and were left.

## Choices in build-curated.mjs

- Pickups (`\partial`) are shifted so bar 1 starts on beat 0. Arabesque's single 2/4 bar is padded to 4/4.
- Tempos come from the MIDI, except Gymnopédie (66), Arabesque (88) and Maple Leaf Rag (100) where the
  engraved default doesn't match the marking. Key changes keep the opening key signature (later sections
  show accidentals).

## Not curated

Canon in D (Mutopia only has a violin part), Be Thou My Vision and What a Friend We Have in Jesus (no
Mutopia source), How Great Thou Art (the English text and arrangement are still under copyright).
These stay locked until a recording exists, like every other song.
