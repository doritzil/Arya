import { toMIDI, toMusicXML, type BuildResult } from '@aria/score-engine';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * FR-22: export MIDI, MusicXML and PDF through the iOS share sheet. Files only leave the phone when the
 * user shares them (NFR-2). The web preview downloads instead.
 */
export type ExportKind = 'pdf' | 'musicxml' | 'midi';

const safe = (s: string) => s.replace(/[^\p{L}\p{N} _-]+/gu, '').trim().slice(0, 60) || 'Aria';

export async function exportScore(kind: ExportKind, build: BuildResult, title: string, svgPages?: string[]) {
  const name = safe(title);
  if (kind === 'midi') return share(`${name}.mid`, toMIDI(build.model, build.beatMap), 'audio/midi', 'public.midi-audio');
  if (kind === 'musicxml')
    return share(`${name}.musicxml`, toMusicXML(build.model, title), 'application/vnd.recordare.musicxml+xml', 'com.recordare.musicxml');
  if (!svgPages?.length) throw new Error('The score is still being drawn — try again in a moment.');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 12mm; } body { margin: 0; font-family: -apple-system, sans-serif; color: #111; }
    h1 { font-size: 20px; margin: 0 0 8px; } .page { page-break-after: always; } .page svg { width: 100%; height: auto; }
  </style></head><body><h1>${escapeHtml(title)}</h1>${svgPages.map((s) => `<div class="page">${s}</div>`).join('')}</body></html>`;
  if (Platform.OS === 'web') return Print.printAsync({ html });
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

async function share(filename: string, content: string | Uint8Array, mimeType: string, UTI: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content as BlobPart], { type: mimeType });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle: filename });
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
