import type { FallNote } from '@aria/score-engine';

import { fitRange, layoutKeys, soundingAt } from './geometry';

const n = (pitch: number, startSec: number, endSec: number): FallNote =>
  ({ id: `${pitch}-${startSec}`, pitch, startSec, endSec, hand: pitch < 60 ? 'L' : 'R', bar: 0, name: 'C4' }) as FallNote;

describe('keyboard geometry', () => {
  it('fits the range to C…E with at least 2½ octaves', () => {
    expect(fitRange([])).toEqual({ low: 48, high: 76 });
    const r = fitRange([n(62, 0, 1), n(65, 0, 1)]);
    expect(r.low % 12).toBe(0);
    expect(r.high % 12).toBe(4);
    expect(r.high - r.low).toBeGreaterThanOrEqual(29);
  });

  it('lays out white keys edge to edge and black keys between them', () => {
    const keys = layoutKeys(48, 76, 850);
    const whites = keys.filter((k) => !k.black);
    expect(whites).toHaveLength(17);
    expect(whites.at(-1)!.x + whites.at(-1)!.width).toBeCloseTo(850);
    const cs = keys.find((k) => k.pitch === 49)!;
    expect(cs.black).toBe(true);
    expect(cs.x).toBeGreaterThan(0);
  });

  it('finds the notes sounding at a time', () => {
    const notes = [n(60, 0, 2), n(64, 1, 1.5), n(67, 1.2, 3), n(72, 4, 5)];
    expect(soundingAt(notes, 1.3).map((x) => x.pitch).sort()).toEqual([60, 64, 67]);
    expect(soundingAt(notes, 3.5)).toEqual([]);
  });
});
