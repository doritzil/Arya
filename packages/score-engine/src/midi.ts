// Standard MIDI File, type 1: track 1 = right hand (treble) with tempo/metre/key meta,
// track 2 = left hand (bass). Without a beat map the tempo is the score tempo; with one,
// a tempo event per quarter beat reproduces the performance timing.

import type { BeatMap, ScoreModel } from './types';
import { meterInfo } from './meter';

const PPQ = 480;

export function toMIDI(model: ScoreModel, beatMap?: BeatMap): Uint8Array {
  const m = meterInfo(model.settings.timeSig);
  const meta: [number, number[]][] = [];
  meta.push([0, text(0x03, 'Right hand')]);
  meta.push([0, [0xff, 0x58, 4, m.count, Math.log2(m.unit), m.compound ? 36 : 24, 8]]);
  const mi = model.settings.keyMode === 'minor' ? 1 : 0;
  meta.push([0, [0xff, 0x59, 2, (model.settings.keyFifths + 256) & 0xff, mi]]);
  if (beatMap && beatMap.beats.length >= 2) {
    const b = beatMap.beats;
    let last = -1;
    for (let j = 0; j + 1 < b.length; j++) {
      const us = Math.round((b[j + 1]! - b[j]!) * 1e6);
      if (us > 0 && us !== last) {
        meta.push([j * PPQ, tempo(us)]);
        last = us;
      }
    }
  } else meta.push([0, tempo(Math.round(60e6 / model.settings.tempoBpm))]);

  const tracks = (['treble', 'bass'] as const).map((staff, ti) => {
    const ch = ti;
    const ev: [number, number[]][] = ti === 0 ? [...meta] : [[0, text(0x03, 'Left hand')]];
    ev.push([0, [0xc0 | ch, 0]]);
    for (const n of model.notes) {
      if (n.staff !== staff) continue;
      const on = Math.round(n.beat * PPQ);
      const off = Math.max(on + 1, Math.round((n.beat + n.beats) * PPQ));
      ev.push([on, [0x90 | ch, n.pitch, Math.min(127, Math.max(1, n.velocity))]]);
      ev.push([off, [0x80 | ch, n.pitch, 0]]);
    }
    // stable order: by tick, meta first, note-offs before note-ons
    const rank = (e: number[]) => (e[0] === 0xff ? 0 : (e[0]! & 0xf0) === 0x80 ? 1 : 2);
    ev.sort((a, b) => a[0] - b[0] || rank(a[1]) - rank(b[1]));
    return track(ev);
  });

  const out: number[] = [...ascii('MThd'), ...u32(6), ...u16(1), ...u16(2), ...u16(PPQ)];
  for (const t of tracks) {
    out.push(...ascii('MTrk'), ...u32(t.length));
    for (const b of t) out.push(b); // no spread: big arrays can exceed engine arg limits
  }
  return Uint8Array.from(out);
}

function track(ev: [number, number[]][]): number[] {
  const out: number[] = [];
  let now = 0;
  for (const [tick, bytes] of ev) {
    out.push(...vlq(tick - now), ...bytes);
    now = tick;
  }
  out.push(0, 0xff, 0x2f, 0);
  return out;
}

function tempo(us: number): number[] {
  const v = Math.min(0xffffff, us);
  return [0xff, 0x51, 3, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}
function text(type: number, s: string): number[] {
  const b = ascii(s);
  return [0xff, type, ...vlq(b.length), ...b];
}
function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0) & 0x7f);
}
function u32(v: number): number[] {
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
}
function u16(v: number): number[] {
  return [(v >> 8) & 0xff, v & 0xff];
}
export function vlq(v: number): number[] {
  const bytes = [v & 0x7f];
  v >>>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  return bytes;
}
