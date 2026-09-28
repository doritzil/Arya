// MEI 5 serializer (rendering via Verovio). Every note's xml:id is our note id; tied
// continuation pieces get `${id}_t<k>` (see baseNoteId).

import type { MeasureEvent, NoteHead, NoteValue, ScoreModel } from './types';
import { meterInfo } from './meter';
import { esc } from './xml';

const DUR: Record<NoteValue, string> = { whole: '1', half: '2', quarter: '4', eighth: '8', '16th': '16', '32nd': '32' };
const ACCID: Record<string, string> = { sharp: 's', flat: 'f', natural: 'n', 'double-sharp': 'x', 'flat-flat': 'ff' };
const GES: Record<number, string> = { [-2]: 'ff', [-1]: 'f', 1: 's', 2: 'ss' };
const TIE = { start: 'i', continue: 'm', stop: 't' } as const;

export function keySigAttr(fifths: number): string {
  return fifths === 0 ? '0' : `${Math.abs(fifths)}${fifths > 0 ? 's' : 'f'}`;
}

export function toMEI(model: ScoreModel, title = 'Untitled'): string {
  const { settings } = model;
  const m = meterInfo(settings.timeSig);
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">');
  out.push(`<meiHead><fileDesc><titleStmt><title>${esc(title)}</title></titleStmt><pubStmt/></fileDesc></meiHead>`);
  out.push('<music><body><mdiv><score>');
  out.push(`<scoreDef midi.bpm="${settings.tempoBpm}">`);
  out.push(`<keySig sig="${keySigAttr(settings.keyFifths)}" mode="${settings.keyMode}"/>`);
  out.push(`<meterSig count="${m.count}" unit="${m.unit}"/>`);
  out.push('<staffGrp symbol="brace" bar.thru="true">');
  out.push('<staffDef n="1" lines="5"><clef shape="G" line="2"/></staffDef>');
  out.push('<staffDef n="2" lines="5"><clef shape="F" line="4"/></staffDef>');
  out.push('</staffGrp></scoreDef>');
  out.push('<section>');
  for (const meas of model.measures) {
    out.push(`<measure n="${meas.number}" xml:id="m${meas.number}">`);
    for (const st of meas.staves) {
      out.push(`<staff n="${st.n}"><layer n="1">`);
      let beamOpen = false;
      let tupOpen = false;
      for (const e of st.events) {
        if (e.tupletStart && !tupOpen) {
          out.push('<tuplet num="3" numbase="2">');
          tupOpen = true;
        }
        if (e.beam === 'begin' && !beamOpen) {
          out.push('<beam>');
          beamOpen = true;
        }
        out.push(eventXml(e));
        if (beamOpen && (e.beam === 'end' || e.tupletStop)) {
          out.push('</beam>');
          beamOpen = false;
        }
        if (tupOpen && e.tupletStop) {
          out.push('</tuplet>');
          tupOpen = false;
        }
      }
      if (beamOpen) out.push('</beam>');
      if (tupOpen) out.push('</tuplet>');
      out.push('</layer></staff>');
    }
    out.push('</measure>');
  }
  out.push('</section></score></mdiv></body></music></mei>');
  return out.join('\n');
}

function durAttrs(e: MeasureEvent): string {
  return ` dur="${DUR[e.value]}"${e.dots ? ` dots="${e.dots}"` : ''}`;
}

function eventXml(e: MeasureEvent): string {
  if (e.kind === 'rest') {
    if (e.measureRest) return `<mRest xml:id="${esc(e.xmlId)}"/>`;
    return `<rest xml:id="${esc(e.xmlId)}"${durAttrs(e)}/>`;
  }
  if (e.notes.length === 1) return noteXml(e.notes[0]!, durAttrs(e));
  return `<chord xml:id="${esc(e.xmlId)}"${durAttrs(e)}>${e.notes.map((h) => noteXml(h, '')).join('')}</chord>`;
}

function noteXml(h: NoteHead, dur: string): string {
  const sp = h.spelled;
  let a = `<note xml:id="${esc(h.xmlId)}" pname="${sp.step.toLowerCase()}" oct="${sp.octave}"${dur}`;
  if (h.accidental) a += ` accid="${ACCID[h.accidental]}"`;
  else if (sp.alter !== 0) a += ` accid.ges="${GES[sp.alter]}"`;
  if (h.tie) a += ` tie="${TIE[h.tie]}"`;
  return `${a}/>`;
}

/** Maps a serialized id (tied continuation or chord id) back to the note id. */
export function baseNoteId(xmlId: string): string {
  return xmlId.replace(/_c$/, '').replace(/_t\d+$/, '');
}
