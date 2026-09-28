import { baseNoteId, toMIDI, toMusicXML } from '../src';
import { CHORALE, DFLAT, SIX_EIGHT, TRIPLETS, WALTZ, build, xmlProblems } from './fixtures';

const dflat = build(DFLAT);
const trip = build(TRIPLETS, { triplets: true });
const waltz = build(WALTZ, { timeSig: '3/4' });
const six = build(SIX_EIGHT, { timeSig: '6/8' });

describe('xml checker', () => {
  test('catches problems', () => {
    expect(xmlProblems('<a><b></a>')).not.toEqual([]);
    expect(xmlProblems('<a x=1/>')).not.toEqual([]);
    expect(xmlProblems('<a>&</a>')).not.toEqual([]);
    expect(xmlProblems('<?xml version="1.0"?><a x="1"><b/>t &amp; u</a>')).toEqual([]);
  });
});

describe('MEI', () => {
  test.each([
    ['dflat', dflat],
    ['triplets', trip],
    ['waltz', waltz],
    ['6/8', six],
  ])('%s is well-formed MEI 5', (_n, r) => {
    expect(xmlProblems(r.mei)).toEqual([]);
    expect(r.mei).toContain('<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">');
    expect((r.mei.match(/<measure /g) ?? []).length).toBe(r.model.barCount);
  });

  test('every note has xml:id = note id; ids unique', () => {
    for (const n of dflat.model.notes) expect(dflat.mei).toContain(`<note xml:id="${n.id}"`);
    const ids = [...dflat.mei.matchAll(/xml:id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('key, metre, clefs, tempo', () => {
    expect(dflat.mei).toContain('<keySig sig="5f" mode="major"/>');
    expect(dflat.mei).toContain('<meterSig count="4" unit="4"/>');
    expect(dflat.mei).toContain('<clef shape="G" line="2"/>');
    expect(dflat.mei).toContain('<clef shape="F" line="4"/>');
    expect(dflat.mei).toContain('midi.bpm="90"');
    expect(six.mei).toContain('<meterSig count="6" unit="8"/>');
    expect(six.mei).toContain('<keySig sig="1f"');
    // flats in the signature are gestural only
    expect(dflat.mei).toMatch(/pname="a" oct="4" dur="4" accid.ges="f"/);
  });

  test('ties, tuplets, beams', () => {
    const g5 = waltz.model.notes.find((n) => n.name === 'G5' && n.beat === 5)!;
    expect(waltz.mei).toContain(`<note xml:id="${g5.id}" pname="g" oct="5" dur="4" tie="i"/>`);
    expect(waltz.mei).toContain(`<note xml:id="${g5.id}_t1" pname="g" oct="5" dur="4" tie="t"/>`);
    expect(baseNoteId(`${g5.id}_t1`)).toBe(g5.id);
    expect((trip.mei.match(/<tuplet num="3" numbase="2">/g) ?? []).length).toBe(6);
    expect(trip.mei).toMatch(/<tuplet num="3" numbase="2">\n<beam>\n<note [^>]+dur="8"/);
    expect(dflat.mei).toContain('<beam>');
  });

  test('chords', () => {
    expect(waltz.mei).toMatch(/<chord xml:id="[^"]+_c" dur="4"><note [^>]+\/><note [^>]+\/><note [^>]+\/><\/chord>/);
  });
});

describe('MusicXML', () => {
  test.each([
    ['dflat', dflat],
    ['triplets', trip],
    ['waltz', waltz],
    ['6/8', six],
  ])('%s is well-formed 4.0 partwise', (_n, r) => {
    const x = toMusicXML(r.model, 'Test & <Title>');
    expect(xmlProblems(x)).toEqual([]);
    expect(x).toContain('<score-partwise version="4.0">');
    expect(x).toContain('<work-title>Test &amp; &lt;Title&gt;</work-title>');
    expect((x.match(/<measure /g) ?? []).length).toBe(r.model.barCount);
    expect(x).toContain('<staves>2</staves>');
    for (const n of r.model.notes) expect(x).toContain(`<note id="${n.id}">`);
  });

  test('key, time, clefs, durations', () => {
    const x = toMusicXML(dflat.model);
    expect(x).toContain('<key><fifths>-5</fifths><mode>major</mode></key>');
    expect(x).toContain('<time><beats>4</beats><beat-type>4</beat-type></time>');
    expect(x).toContain('<clef number="2"><sign>F</sign><line>4</line></clef>');
    expect(x).toContain('<divisions>48</divisions>');
    expect(x).toContain('<step>A</step><alter>-1</alter><octave>4</octave>');
    // each measure: staff 1 fills 192, backup 192, staff 2 fills 192
    const m1 = x.slice(x.indexOf('<measure number="1">'), x.indexOf('</measure>'));
    const durs = [...m1.matchAll(/<note[^>]*>(?:(?!<\/note>).)*?<duration>(\d+)<\/duration>/g)]
      .filter((mm) => !mm[0].includes('<chord/>'))
      .map((mm) => Number(mm[1]));
    expect(durs.reduce((a, b) => a + b, 0)).toBe(2 * 192);
    expect(m1).toContain('<backup><duration>192</duration></backup>');
    const s = toMusicXML(six.model);
    expect(s).toContain('<time><beats>6</beats><beat-type>8</beat-type></time>');
    expect(s).toContain('<beat-unit-dot/><per-minute>60</per-minute>');
  });

  test('ties and tuplets', () => {
    const x = toMusicXML(waltz.model);
    expect(x).toContain('<tie type="start"/>');
    expect(x).toContain('<tied type="stop"/>');
    const t = toMusicXML(trip.model);
    expect(t).toContain('<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>');
    expect((t.match(/<tuplet type="start"/g) ?? []).length).toBe(6);
    expect((t.match(/<tuplet type="stop"/g) ?? []).length).toBe(6);
  });
});

describe('MIDI', () => {
  const readU32 = (b: Uint8Array, i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
  const str = (b: Uint8Array, i: number) => String.fromCharCode(...b.slice(i, i + 4));

  function parse(b: Uint8Array) {
    expect(str(b, 0)).toBe('MThd');
    expect(readU32(b, 4)).toBe(6);
    const format = (b[8]! << 8) | b[9]!;
    const ntrk = (b[10]! << 8) | b[11]!;
    const ppq = (b[12]! << 8) | b[13]!;
    const tracks: Uint8Array[] = [];
    let i = 14;
    while (i < b.length) {
      expect(str(b, i)).toBe('MTrk');
      const len = readU32(b, i + 4);
      tracks.push(b.slice(i + 8, i + 8 + len));
      i += 8 + len;
    }
    expect(i).toBe(b.length);
    return { format, ntrk, ppq, tracks };
  }
  const has = (t: Uint8Array, seq: number[]) => {
    outer: for (let i = 0; i + seq.length <= t.length; i++) {
      for (let j = 0; j < seq.length; j++) if (t[i + j] !== seq[j]) continue outer;
      return true;
    }
    return false;
  };
  const noteOns = (t: Uint8Array) => {
    let c = 0;
    for (let i = 0; i < t.length - 2; i++) if ((t[i]! & 0xf0) === 0x90 && t[i + 2]! > 0 && t[i + 1]! < 128) c++;
    return c;
  };

  test('type 1, two tracks, tempo/time/key meta, note count', () => {
    const b = toMIDI(dflat.model);
    const { format, ntrk, ppq, tracks } = parse(b);
    expect([format, ntrk, ppq]).toEqual([1, 2, 480]);
    expect(tracks.length).toBe(2);
    const t1 = tracks[0]!;
    const us = Math.round(60e6 / 90);
    expect(has(t1, [0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff])).toBe(true);
    expect(has(t1, [0xff, 0x58, 4, 4, 2, 24, 8])).toBe(true);
    expect(has(t1, [0xff, 0x59, 2, 0xfb, 0])).toBe(true);
    for (const t of tracks) expect(Array.from(t.slice(-3))).toEqual([0xff, 0x2f, 0]);
    const rh = dflat.model.notes.filter((n) => n.staff === 'treble').length;
    expect(noteOns(t1)).toBeGreaterThanOrEqual(rh); // ≥: heuristic scan may overcount
    expect(noteOns(tracks[1]!)).toBeGreaterThanOrEqual(dflat.model.notes.length - rh);
  });

  test('with a beat map, tempo events follow the performance', () => {
    const r = build({ ...CHORALE, drift: 0.1 });
    const { tracks } = parse(toMIDI(r.model, r.beatMap));
    let tempos = 0;
    const t = tracks[0]!;
    for (let i = 0; i < t.length - 2; i++) if (t[i] === 0xff && t[i + 1] === 0x51 && t[i + 2] === 3) tempos++;
    expect(tempos).toBeGreaterThan(5);
  });
});
