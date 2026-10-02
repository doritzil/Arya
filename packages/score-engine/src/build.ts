// buildScore: raw notes (seconds) + settings + edit log → ScoreModel, BeatMap, MEI.
// raw → pedal → tempo/beats → downbeat → quantize → edits → key → hands → spelling → measures.

import type { BuildResult, EditLog, RawNotes, ScoreModel, ScoreNote, ScoreSettings, Staff } from './types';
import { meterInfo } from './meter';
import { applyPedal } from './pedal';
import { chooseDownbeat, estimateTempo, makeInterp, onsetEvents, trackBeats } from './tempo';
import { makeBeatMap, quarterBeatSecs } from './beatmap';
import { quantize } from './quantize';
import { applyEditLog } from './edits';
import { detectKey } from './key';
import { splitHands } from './hands';
import { spellPitch, spelledName } from './spell';
import { buildMeasures } from './measures';
import { toMEI } from './mei';

const now = (): number => {
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return perf ? perf.now() : Date.now();
};

export function buildScore(raw: RawNotes, settings: ScoreSettings, edits?: EditLog): BuildResult {
  const t0 = now();
  const meter = meterInfo(settings.timeSig);
  const perf = applyPedal(raw.notes ?? [], raw.pedal ?? []);
  const ev = onsetEvents(perf);

  // tempo & beats
  const lastSec = perf.reduce((m, n) => Math.max(m, n.offset), 0);
  const exact = raw.exactTempoBpm && raw.exactTempoBpm > 0 ? raw.exactTempoBpm : undefined;
  const detected = exact ?? estimateTempo(ev, meter.unitQ, meter.compound, settings.countInBpm);
  const override = settings.tempoBpm && settings.tempoBpm > 0 ? Math.min(400, Math.max(20, settings.tempoBpm)) : undefined;
  const tempo = exact ?? override ?? detected;
  // an override unrelated to what was played (not ~×½, ×1, ×2, ×3) gets a rigid grid instead of tracking
  const related = [1 / 3, 0.5, 1, 2, 3].some((r) => Math.abs(tempo / (detected * r) - 1) < 0.12);
  const P = (meter.unitQ * 60) / tempo;
  // Curated scores: a rigid grid from t = 0 (the first barline) — nothing to detect.
  const unitTimes = exact ? rigidUnits(P, lastSec) : trackBeats(ev, P, !related);
  const unit = makeInterp(unitTimes);
  const u0 = exact ? 0 : chooseDownbeat(ev, unit, meter.unitsPerBar, P);
  const lastQ = Math.max(0, (unit.toPos(lastSec) - u0) * meter.unitQ);
  const tempoOut = exact ?? override ?? Math.round(detected);
  const prelim = makeBeatMap(quarterBeatSecs(unitTimes, u0, meter.unitQ, Math.ceil(lastQ) + meter.beatsPerBar), tempoOut);

  // quantize + edits
  const q = quantize(perf, prelim.secToBeat, settings.grid, settings.triplets, meter);
  const applied = applyEditLog(q.notes, edits);
  const notes = applied.notes;

  // key
  const det = detectKey(notes);
  const keyFifths = settings.keyFifths ?? det.fifths;
  const keyMode = settings.keyMode ?? det.mode;

  // hands + spelling
  const staffs = splitHands(notes);
  const scoreNotes: ScoreNote[] = notes.map((n, i) => ({
    id: n.id,
    pitch: n.pitch,
    spelled: { step: 'C', alter: 0, octave: 4 },
    name: '',
    beat: n.beat,
    beats: n.beats,
    staff: staffs[i]!,
    velocity: n.velocity,
    ...(n.added ? { added: true } : {}),
  }));
  spellAll(scoreNotes, keyFifths, keyMode);

  // bars
  const bpb = meter.beatsPerBar;
  let endBeat = 0;
  for (const n of scoreNotes) endBeat = Math.max(endBeat, n.beat + n.beats);
  for (const r of applied.rests) endBeat = Math.max(endBeat, r.beat + r.beats);
  const barCount = Math.max(1, Math.ceil(endBeat / bpb - 1e-9));
  const measures = buildMeasures(scoreNotes, applied.rests, meter, barCount, q.tripletBeats, keyFifths);

  const model: ScoreModel = {
    settings: { timeSig: settings.timeSig, grid: settings.grid, triplets: settings.triplets, tempoBpm: tempoOut, keyFifths, keyMode },
    beatsPerBar: bpb,
    barCount,
    notes: scoreNotes,
    rests: applied.rests,
    measures,
    tripletBeats: [...q.tripletBeats].sort((a, b) => a - b),
  };
  const quarters = Math.max(barCount * bpb, Math.ceil(lastQ));
  const beatMap = makeBeatMap(quarterBeatSecs(unitTimes, u0, meter.unitQ, quarters), tempoOut);
  const mei = toMEI(model);

  return {
    model,
    beatMap,
    mei,
    diagnostics: {
      detectedTempoBpm: Math.round(detected * 10) / 10,
      detectedKeyFifths: det.fifths,
      detectedKeyMode: det.mode,
      droppedEdits: applied.dropped,
      noteCount: scoreNotes.length,
      elapsedMs: now() - t0,
    },
  };
}

/** Spells every note; a chromatic note uses the semitone-neighbour in the next slice of its staff as context. */
function spellAll(notes: ScoreNote[], keyFifths: number, keyMode: ScoreModel['settings']['keyMode']): void {
  for (const staff of ['treble', 'bass'] as Staff[]) {
    const list = notes.filter((n) => n.staff === staff).sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
    // slices of equal onset
    const slices: ScoreNote[][] = [];
    for (const n of list) {
      const last = slices[slices.length - 1];
      if (last && Math.abs(last[0]!.beat - n.beat) < 1e-6) last.push(n);
      else slices.push([n]);
    }
    slices.forEach((sl, i) => {
      const nextSl = slices[i + 1] ?? [];
      for (const n of sl) {
        const nb = nextSl.find((x) => Math.abs(x.pitch - n.pitch) === 1);
        n.spelled = spellPitch(n.pitch, keyFifths, keyMode, nb?.pitch);
        n.name = spelledName(n.spelled);
      }
    });
  }
}

/** Unit-beat times every P seconds from 0, past the last note. */
function rigidUnits(P: number, lastSec: number): number[] {
  const n = Math.ceil(lastSec / P) + 2;
  return Array.from({ length: n + 1 }, (_, i) => i * P);
}
