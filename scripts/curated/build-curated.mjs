#!/usr/bin/env node
/**
 * Curated scores for public-domain pieces (Keyboard mode + sheet music without a recording).
 *
 *   scripts/curated/midi/<catalogId>.mid  →  src/data/curated/<catalogId>.json
 *
 * The MIDI files were engraved with LilyPond from Mutopia Project sources (see SOURCES.md for each
 * piece's source, licence and the small syntax fixes needed for LilyPond 2.25). Track 1 is the upper
 * staff (right hand), track 2 the lower (left hand).
 *
 * Output is in quarter beats from the first full barline: pickups are shifted so bar 1 starts at 0,
 * and a bar in a different metre is padded to the piece's main bar length so barlines stay aligned.
 *
 *   node scripts/curated/build-curated.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../../src/data/curated');

/** Per piece: metadata, settings, and the pickup length in quarter beats (\partial in the source). */
const PIECES = {
  'fu-r-elise--beethoven': { title: 'Für Elise', composer: 'Ludwig van Beethoven', timeSig: '3/8', key: [0, 'minor'], pickup: 0.5, license: 'Public Domain', mutopia: 'BeethovenLv/WoO59/fur_Elise_WoO59' },
  'gymnope-die-no-1--satie': { title: 'Gymnopédie No. 1', composer: 'Erik Satie', timeSig: '3/4', key: [2, 'major'], tempo: 66, license: 'Public Domain', mutopia: 'SatieE/gymnopedie_1' },
  'clair-de-lune--debussy': { title: 'Clair de Lune', composer: 'Claude Debussy', timeSig: '9/8', key: [-5, 'major'], license: 'Public Domain', mutopia: 'DebussyC/L75/debussy_Ste_Bergamesq_Clair' },
  'prelude-in-e-minor-op-28-no-4--chopin': { title: 'Prelude in E minor, Op. 28 No. 4', composer: 'Frédéric Chopin', timeSig: '2/2', key: [1, 'minor'], pickup: 1, license: 'Public Domain', mutopia: 'ChopinFF/O28/Chop-28-4' },
  'minuet-in-g--bach-attr-petzold': { title: 'Minuet in G', composer: 'Christian Petzold (attr. J. S. Bach)', timeSig: '3/4', key: [1, 'major'], license: 'Public Domain', mutopia: 'BachJS/BWVAnh114/anna-magdalena-04' },
  'moonlight-sonata-1st-mvt--beethoven': { title: 'Moonlight Sonata, 1st mvt', composer: 'Ludwig van Beethoven', timeSig: '2/2', key: [4, 'minor'], triplets: true, license: 'CC BY-SA 2.5', credit: 'Typeset by Stewart Holmes', mutopia: 'BeethovenLv/O27/moonlight' },
  'arabesque-no-1--debussy': { title: 'Arabesque No. 1', composer: 'Claude Debussy', timeSig: '4/4', key: [4, 'major'], tempo: 88, triplets: true, license: 'Public Domain', mutopia: 'DebussyC/L66/debussy_Arabesque_1' },
  'nocturne-in-e-flat-op-9-no-2--chopin': { title: 'Nocturne in E-flat, Op. 9 No. 2', composer: 'Frédéric Chopin', timeSig: '12/8', key: [-3, 'major'], pickup: 0.5, license: 'CC BY-SA 3.0', credit: 'Typeset by Renato Biolcati Rinaldi', mutopia: 'ChopinFF/O9/chopin_nocturne_op9_n2' },
  'maple-leaf-rag--scott-joplin': { title: 'Maple Leaf Rag', composer: 'Scott Joplin', timeSig: '2/4', key: [-4, 'major'], tempo: 100, pickup: 0.5, license: 'Public Domain', mutopia: 'JoplinS/maple' },
  'the-entertainer--scott-joplin': { title: 'The Entertainer', composer: 'Scott Joplin', timeSig: '2/4', key: [0, 'major'], license: 'Public Domain', mutopia: 'JoplinS/entertainer' },
  'amazing-grace--traditional': { title: 'Amazing Grace (New Britain)', composer: 'Traditional', timeSig: '3/4', key: [1, 'major'], pickup: 1, license: 'Public Domain', mutopia: 'Anonymous/new_britain' },
};

// ── Minimal Standard MIDI File reader (format 0/1, running status) ─────────────────────────────────
function readMidi(buf) {
  let p = 0;
  const u32 = () => ((buf[p++] << 24) | (buf[p++] << 16) | (buf[p++] << 8) | buf[p++]) >>> 0;
  const u16 = () => (buf[p++] << 8) | buf[p++];
  const vlq = () => {
    let v = 0;
    for (;;) {
      const b = buf[p++];
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
  };
  if (buf.toString('latin1', 0, 4) !== 'MThd') throw new Error('not a MIDI file');
  p = 8;
  const _format = u16();
  const ntracks = u16();
  const tpq = u16();
  const tracks = [];
  const meta = { tempos: [], timeSigs: [] };
  for (let t = 0; t < ntracks; t++) {
    if (buf.toString('latin1', p, p + 4) !== 'MTrk') throw new Error('bad track');
    p += 4;
    const end = u32() + p;
    let tick = 0;
    let status = 0;
    const open = new Map();
    const notes = [];
    while (p < end) {
      tick += vlq();
      let b = buf[p];
      if (b & 0x80) {
        status = b;
        p++;
      }
      const type = status & 0xf0;
      if (status === 0xff) {
        const kind = buf[p++];
        const len = vlq();
        if (kind === 0x51) meta.tempos.push({ tick, bpm: 60e6 / ((buf[p] << 16) | (buf[p + 1] << 8) | buf[p + 2]) });
        if (kind === 0x58) meta.timeSigs.push({ tick, num: buf[p], den: 2 ** buf[p + 1] });
        p += len;
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
      } else if (type === 0x90 || type === 0x80) {
        const pitch = buf[p++];
        const vel = buf[p++];
        const k = `${status & 0x0f}:${pitch}`;
        if (type === 0x90 && vel > 0) {
          if (!open.has(k)) open.set(k, []);
          open.get(k).push({ tick, vel });
        } else {
          const on = open.get(k)?.shift();
          if (on) notes.push({ pitch, on: on.tick, off: tick, vel: on.vel });
        }
      } else if (type === 0xc0 || type === 0xd0) {
        p += 1;
      } else {
        p += 2;
      }
    }
    p = end;
    if (notes.length) tracks.push(notes);
  }
  return { tpq, tracks, meta };
}

const r = (x) => Math.round(x * 1e4) / 1e4;
const barQuarters = (num, den) => (num * 4) / den;

for (const [id, piece] of Object.entries(PIECES)) {
  const { tpq, tracks, meta } = readMidi(readFileSync(join(here, 'midi', `${id}.mid`)));
  if (tracks.length < 2) throw new Error(`${id}: expected two staves, got ${tracks.length}`);
  const [num, den] = piece.timeSig.split('/').map(Number);
  const mainBar = barQuarters(num, den);
  const tempo = piece.tempo ?? Math.round(meta.tempos[0]?.bpm ?? 60);
  const shift = piece.pickup ? mainBar - piece.pickup : 0;

  // Metre changes (in quarter beats, before the pickup shift): bars of another length get padded.
  const sigs = meta.timeSigs.map((s) => ({ q: s.tick / tpq, len: barQuarters(s.num, s.den) })).sort((a, b) => a.q - b.q);
  const pads = [];
  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i];
    if (Math.abs(s.len - mainBar) < 1e-9) continue;
    const next = sigs[i + 1]?.q ?? Infinity;
    const bars = Math.round((next - s.q) / s.len);
    if (Number.isFinite(next)) pads.push({ after: next, add: bars * (mainBar - s.len) });
  }
  const at = (q) => q + shift + pads.filter((p) => q >= p.after - 1e-9).reduce((a, p) => a + p.add, 0);

  const notes = [];
  tracks.slice(0, 2).forEach((track, staff) => {
    for (const n of track) {
      const on = at(n.on / tpq);
      const off = at(n.off / tpq);
      if (off <= on || n.pitch < 21 || n.pitch > 108) continue;
      notes.push([n.pitch, r(on), r(off - on), n.vel, staff]);
    }
  });
  notes.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  const out = {
    title: piece.title,
    composer: piece.composer,
    source: `Mutopia Project — https://www.mutopiaproject.org (ftp/${piece.mutopia})`,
    license: piece.license,
    ...(piece.credit ? { credit: piece.credit } : null),
    settings: {
      timeSig: piece.timeSig,
      keyFifths: piece.key[0],
      keyMode: piece.key[1],
      tempoBpm: tempo,
      grid: 'sixteenth',
      triplets: !!piece.triplets,
    },
    /** [pitch, start (quarter beats from bar 1), length (quarter beats), velocity, staff 0 = treble / 1 = bass] */
    notes,
  };
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(out) + '\n');
  console.log(`${id}: ${notes.length} notes, ${tempo} bpm${pads.length ? `, padded ${pads.map((p) => p.add).join('+')} beats` : ''}`);
}
