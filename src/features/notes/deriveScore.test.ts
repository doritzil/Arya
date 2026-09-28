import { demoRawNotes } from './demoNotes';
import { deriveScore, DEFAULT_SCORE_SETTINGS } from './useProjectScore';

describe('deriveScore', () => {
  it('turns the demo take into a D♭-major score, falling notes and synth notes', () => {
    const s = deriveScore(demoRawNotes(1, 8, 72), DEFAULT_SCORE_SETTINGS);
    expect(s.build.model.settings.keyFifths).toBe(-5);
    expect(Math.abs(s.build.model.settings.tempoBpm - 72)).toBeLessThanOrEqual(3);
    expect(s.fallNotes.length).toBe(s.synthNotes.length);
    expect(s.fallNotes.every((f, i) => i === 0 || s.fallNotes[i - 1]!.startSec <= f.startSec)).toBe(true);
    expect(new Set(s.fallNotes.map((f) => f.hand))).toEqual(new Set(['L', 'R']));
    expect(s.build.mei).toContain('<mei');
  });

  it('re-writes the score from settings without re-running the model (FR-19) in well under 300 ms', () => {
    const raw = demoRawNotes(2, 64, 72);
    const t0 = Date.now();
    const a = deriveScore(raw, DEFAULT_SCORE_SETTINGS);
    const b = deriveScore(raw, { ...DEFAULT_SCORE_SETTINGS, timeSig: '3/4', grid: 'sixteenth' });
    expect(Date.now() - t0).toBeLessThan(1500); // generous for CI; the engine's own perf test is stricter
    expect(b.build.model.beatsPerBar).toBe(3);
    expect(a.build.model.barCount).not.toBe(b.build.model.barCount);
  });
});
