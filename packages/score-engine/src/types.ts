// Public types of @aria/score-engine.
//
// Units: every `beat` / `beats` value in the score layer is measured in QUARTER NOTES,
// counted from 0 at the first barline — in every time signature, including 6/8
// (a 6/8 bar is 3 quarter-beats long; its felt beat is a dotted quarter = 1.5).
// `tempoBpm` is likewise always quarter notes per minute.

export interface RawNote {
  id: string;
  pitch: number; // MIDI 21-108
  onset: number; // sec
  offset: number; // sec
  velocity: number; // 1-127
}
export interface PedalSpan {
  on: number;
  off: number;
}
export interface RawNotes {
  notes: RawNote[];
  pedal: PedalSpan[];
}

export type TimeSig = '2/4' | '3/4' | '4/4' | '6/8';
export type Grid = 'quarter' | 'eighth' | 'sixteenth';
export type KeyMode = 'major' | 'minor';

export interface ScoreSettings {
  /** Quarter-note BPM. Overrides detection. */
  tempoBpm?: number;
  timeSig: TimeSig;
  keyFifths?: number;
  keyMode?: KeyMode;
  grid: Grid;
  triplets: boolean;
  /** Metronome count-in tempo (quarter-note BPM); seeds and constrains detection to ±12 %. */
  countInBpm?: number;
}

export type Staff = 'treble' | 'bass';

export type EditOp =
  | { t: 'pitch'; noteId: string; pitch: number }
  | { t: 'length'; noteId: string; beats: number }
  | { t: 'delete'; noteId: string }
  | { t: 'addNote'; id: string; beat: number; pitch: number; beats: number; staff: Staff }
  | { t: 'addRest'; id: string; beat: number; beats: number; staff: Staff };

/** ops[0..head) are applied. */
export interface EditLog {
  ops: EditOp[];
  head: number;
}

export interface SpelledPitch {
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  alter: -2 | -1 | 0 | 1 | 2;
  octave: number;
}

export interface ScoreNote {
  id: string;
  pitch: number;
  spelled: SpelledPitch;
  /** ASCII name, e.g. 'Ab4', 'F#3'. */
  name: string;
  /** Absolute quarter-beat position from 0. */
  beat: number;
  /** Own (quantized/edited) length in quarter beats. Notation may shorten it, see measures.ts. */
  beats: number;
  staff: Staff;
  velocity: number;
  added?: boolean;
}

export interface RestItem {
  id: string;
  beat: number;
  beats: number;
  staff: Staff;
}

// ---- Notation layer (measures → staves → one voice → events) ----

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';
export type Accidental = 'sharp' | 'flat' | 'natural' | 'double-sharp' | 'flat-flat';

export interface NoteHead {
  /** Unique id in the serialized score. Equals `noteId` for the first piece of a note;
   *  tied continuation pieces are `${noteId}_t1`, `_t2`… (see `baseNoteId`). */
  xmlId: string;
  noteId: string;
  pitch: number;
  spelled: SpelledPitch;
  name: string;
  tie?: 'start' | 'continue' | 'stop';
  /** Accidental to print (already resolved against key signature and earlier notes in the bar). */
  accidental?: Accidental;
}

export interface MeasureEvent {
  kind: 'chord' | 'rest';
  /** For a single-note chord this equals the note head's xmlId; for multi-note chords `${first}_c`. */
  xmlId: string;
  /** Absolute quarter-beat position. */
  beat: number;
  /** Quarter beats from the start of the bar. */
  offset: number;
  beats: number;
  /** Duration in TICKS_PER_QUARTER units (exact integer). */
  ticks: number;
  value: NoteValue;
  dots: 0 | 1;
  /** Eighth-triplet family (3 in the time of 2). */
  triplet?: boolean;
  tupletStart?: boolean;
  tupletStop?: boolean;
  beam?: 'begin' | 'continue' | 'end';
  /** Ascending pitch. Empty for rests. */
  notes: NoteHead[];
  /** Whole-bar rest (MEI mRest / MusicXML rest measure="yes"). */
  measureRest?: boolean;
}

export interface MeasureStaff {
  staff: Staff;
  n: 1 | 2;
  /** Contiguous, non-overlapping, fills the bar exactly. */
  events: MeasureEvent[];
}

export interface Measure {
  /** 1-based. */
  number: number;
  startBeat: number;
  beats: number;
  staves: [MeasureStaff, MeasureStaff];
}

export interface ScoreModel {
  settings: Required<Pick<ScoreSettings, 'timeSig' | 'grid' | 'triplets'>> & {
    tempoBpm: number;
    keyFifths: number;
    keyMode: KeyMode;
  };
  /** Bar length in quarter beats (6/8 → 3). */
  beatsPerBar: number;
  barCount: number;
  /** Sorted by beat then pitch. */
  notes: ScoreNote[];
  /** Explicit (user-added) rests only; filler rests live in `measures`. */
  rests: RestItem[];
  measures: Measure[];
  /** Quarter-beat indices whose beat was quantized to the eighth-triplet grid. */
  tripletBeats: number[];
}

export interface BeatMap {
  beatToSec(beat: number): number;
  secToBeat(sec: number): number;
  /** Seconds of each quarter beat, index 0 = first barline. May be negative for a pickup at t≈0. */
  beats: number[];
  tempoBpm: number;
  offsetSec: number;
}

export interface BuildResult {
  model: ScoreModel;
  beatMap: BeatMap;
  mei: string;
  diagnostics: {
    detectedTempoBpm: number;
    detectedKeyFifths: number;
    detectedKeyMode: KeyMode;
    droppedEdits: number;
    noteCount: number;
    elapsedMs: number;
  };
}

export interface FallNote {
  pitch: number;
  startSec: number;
  endSec: number;
  hand: 'L' | 'R';
  /** 1-based bar number. */
  bar: number;
  name: string;
  id: string;
}

/** A performed note after pedal handling (seconds). */
export interface PerfNote {
  id: string;
  pitch: number;
  onset: number;
  offset: number;
  velocity: number;
}

/** A note in beat space, before staff/spelling. */
export interface QuantNote {
  id: string;
  pitch: number;
  beat: number;
  beats: number;
  velocity: number;
  staff?: Staff;
  added?: boolean;
}

export const TICKS_PER_QUARTER = 48;
