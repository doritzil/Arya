// MusicXML 4.0 partwise: one piano part, two staves (voice 1 = treble, voice 5 = bass).

import type { MeasureEvent, ScoreModel } from './types';
import { TICKS_PER_QUARTER as TPQ } from './types';
import { meterInfo } from './meter';
import { esc } from './xml';

export function toMusicXML(model: ScoreModel, title = 'Untitled'): string {
  const { settings } = model;
  const m = meterInfo(settings.timeSig);
  const o: string[] = [];
  o.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
  o.push(
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
  );
  o.push('<score-partwise version="4.0">');
  o.push(`<work><work-title>${esc(title)}</work-title></work>`);
  o.push('<identification><encoding><software>Aria score-engine</software></encoding></identification>');
  o.push('<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>');
  o.push('<part id="P1">');
  for (const meas of model.measures) {
    o.push(`<measure number="${meas.number}">`);
    if (meas.number === 1) {
      o.push('<attributes>');
      o.push(`<divisions>${TPQ}</divisions>`);
      o.push(`<key><fifths>${settings.keyFifths}</fifths><mode>${settings.keyMode}</mode></key>`);
      o.push(`<time><beats>${m.count}</beats><beat-type>${m.unit}</beat-type></time>`);
      o.push('<staves>2</staves>');
      o.push('<clef number="1"><sign>G</sign><line>2</line></clef>');
      o.push('<clef number="2"><sign>F</sign><line>4</line></clef>');
      o.push('</attributes>');
      const perMin = m.compound ? Math.round(settings.tempoBpm / 1.5) : settings.tempoBpm;
      o.push(
        `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>${
          m.compound ? '<beat-unit-dot/>' : ''
        }<per-minute>${perMin}</per-minute></metronome></direction-type><staff>1</staff><sound tempo="${settings.tempoBpm}"/></direction>`,
      );
    }
    meas.staves.forEach((st, si) => {
      if (si > 0) o.push(`<backup><duration>${Math.round(meas.beats * TPQ)}</duration></backup>`);
      const voice = st.n === 1 ? 1 : 5;
      for (const e of st.events) o.push(...eventXml(e, voice, st.n));
    });
    o.push('</measure>');
  }
  o.push('</part>');
  o.push('</score-partwise>');
  return o.join('\n');
}

function eventXml(e: MeasureEvent, voice: number, staff: number): string[] {
  const common = (isChordTail: boolean, tie?: string, acc?: string): { pre: string; post: string } => {
    const ties: string[] = [];
    const tied: string[] = [];
    if (tie === 'start' || tie === 'continue') {
      ties.push('<tie type="start"/>');
      tied.push('<tied type="start"/>');
    }
    if (tie === 'stop' || tie === 'continue') {
      ties.unshift('<tie type="stop"/>');
      tied.unshift('<tied type="stop"/>');
    }
    const notations: string[] = [...tied];
    if (!isChordTail) {
      if (e.tupletStart) notations.push('<tuplet type="start" bracket="yes"/>');
      if (e.tupletStop) notations.push('<tuplet type="stop"/>');
    }
    const pre = `<duration>${e.ticks}</duration>${ties.join('')}<voice>${voice}</voice>`;
    let post = e.measureRest ? '' : `<type>${e.value}</type>${e.dots ? '<dot/>' : ''}`;
    if (acc) post += `<accidental>${acc}</accidental>`;
    if (e.triplet) post += '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
    post += `<staff>${staff}</staff>`;
    if (e.beam && !isChordTail) post += `<beam number="1">${e.beam}</beam>`;
    if (notations.length) post += `<notations>${notations.join('')}</notations>`;
    return { pre, post };
  };
  if (e.kind === 'rest') {
    const { pre, post } = common(false);
    return [`<note id="${esc(e.xmlId)}">${e.measureRest ? '<rest measure="yes"/>' : '<rest/>'}${pre}${post}</note>`];
  }
  return e.notes.map((h, i) => {
    const { pre, post } = common(i > 0, h.tie, h.accidental);
    const sp = h.spelled;
    const pitch = `<pitch><step>${sp.step}</step>${sp.alter ? `<alter>${sp.alter}</alter>` : ''}<octave>${sp.octave}</octave></pitch>`;
    return `<note id="${esc(h.xmlId)}">${i > 0 ? '<chord/>' : ''}${pitch}${pre}${post}</note>`;
  });
}
