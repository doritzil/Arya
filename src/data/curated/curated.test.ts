import { deriveScore } from '@/features/notes/useProjectScore';
import { SEED_CATALOG } from '@/data/seedCatalog';

import { hasCuratedScore, loadCuratedScore } from '.';

describe('curated scores', () => {
  it('ships a score for every catalog piece that advertises one', () => {
    const flagged = SEED_CATALOG.filter((s) => s.midiUrl);
    expect(flagged.length).toBe(11);
    for (const s of flagged) expect(hasCuratedScore(s.catalogId)).toBe(true);
  });

  it('builds Für Elise in 3/8 with the E–D♯ pickup before bar 1 and the hands from the staves', () => {
    const c = loadCuratedScore('fu-r-elise--beethoven')!;
    const { build } = deriveScore(c.raw, c.settings);
    expect(build.model.settings.timeSig).toBe('3/8');
    expect(build.model.settings.tempoBpm).toBe(72);
    const treble = build.model.notes.filter((n) => n.staff === 'treble').sort((a, b) => a.beat - b.beat);
    // bar = 1.5 quarter beats; the pickup sits at the end of the empty first bar, bar 1 opens on E.
    expect(treble.slice(0, 3).map((n) => [n.pitch, n.beat])).toEqual([
      [76, 1],
      [75, 1.25],
      [76, 1.5],
    ]);
    // the first left-hand note is A2 on the downbeat of bar 2 (beat 3)
    const firstBass = build.model.notes.filter((n) => n.staff === 'bass').sort((a, b) => a.beat - b.beat)[0]!;
    expect([firstBass.pitch, firstBass.beat]).toEqual([45, 3]);
  });

  it('every curated piece builds a score', () => {
    for (const s of SEED_CATALOG.filter((x) => x.midiUrl)) {
      const c = loadCuratedScore(s.catalogId)!;
      const { build, fallNotes } = deriveScore(c.raw, c.settings);
      expect(build.model.barCount).toBeGreaterThan(8);
      expect(fallNotes.length).toBeGreaterThan(100);
      expect(build.mei).toContain('<mei');
    }
  });
});
