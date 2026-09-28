import type { BeatMap } from './types';
import { makeInterp } from './tempo';

/**
 * BeatMap over quarter beats. `beatSecs[j]` is the time of quarter beat j (j = 0 is the
 * first barline). Between entries time is linear; outside, it extrapolates with the edge
 * beat period, so any beat or second maps somewhere sensible.
 */
export function makeBeatMap(beatSecs: number[], tempoBpm: number): BeatMap {
  const secs = beatSecs.length >= 2 ? beatSecs : [beatSecs[0] ?? 0, (beatSecs[0] ?? 0) + 60 / tempoBpm];
  const it = makeInterp(secs);
  return {
    beatToSec: (beat) => it.toSec(beat),
    secToBeat: (sec) => it.toPos(sec),
    beats: secs,
    tempoBpm,
    offsetSec: secs[0]!,
  };
}

/** Quarter-beat times from tracked unit-beat times, starting at unit index `u0`. */
export function quarterBeatSecs(unitTimes: number[], u0: number, unitQ: number, quarters: number): number[] {
  const it = makeInterp(unitTimes);
  const out: number[] = [];
  for (let j = 0; j <= quarters; j++) out.push(it.toSec(u0 + j / unitQ));
  return out;
}
