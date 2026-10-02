import type { TimeSig } from './types';
import { TICKS_PER_QUARTER as TPQ } from './types';

export interface MeterInfo {
  timeSig: TimeSig;
  count: number;
  unit: number;
  /** Bar length in quarter beats. */
  beatsPerBar: number;
  /** Felt beat in quarter beats: 1, or 1.5 (dotted quarter) in compound metres (3/8, 6/8, 9/8, 12/8). */
  unitQ: number;
  unitsPerBar: number;
  compound: boolean;
  barTicks: number;
  unitTicks: number;
}

export function meterInfo(timeSig: TimeSig): MeterInfo {
  const [c, u] = timeSig.split('/').map(Number) as [number, number];
  const compound = u === 8 && c % 3 === 0;
  const beatsPerBar = (c * 4) / u;
  const unitQ = compound ? 1.5 : 1;
  return {
    timeSig,
    count: c,
    unit: u,
    beatsPerBar,
    unitQ,
    unitsPerBar: Math.round(beatsPerBar / unitQ),
    compound,
    barTicks: Math.round(beatsPerBar * TPQ),
    unitTicks: Math.round(unitQ * TPQ),
  };
}
