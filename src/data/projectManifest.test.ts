/// <reference types="jest" />
import {
  ManifestError,
  manifestToProject,
  mergeProjectIntoManifest,
  newManifest,
  parseEditLog,
  parseManifest,
  serializeManifest,
  ulid,
} from './projectManifest';

describe('ulid', () => {
  it('is 26 Crockford chars and sorts by time', () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_001);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a < b).toBe(true);
  });
});

describe('manifest', () => {
  const m = newManifest('song', 'Clair de Lune', 'song-1', { id: '01TEST', now: 1000 });

  it('round-trips through JSON', () => {
    expect(parseManifest(serializeManifest(m))).toEqual(m);
  });

  it('has §5.2 defaults', () => {
    expect(m).toMatchObject({
      schema: 1,
      id: '01TEST',
      kind: 'song',
      songId: 'song-1',
      createdAt: 1000,
      updatedAt: 1000,
      transcription: { status: 'none' },
      scoreSettings: { timeSig: '4/4', grid: 8, triplets: false },
    });
  });

  it('maps to a Project', () => {
    const withAudio = {
      ...m,
      audio: { file: 'audio.m4a', sampleRate: 48000, durationSec: 62.5, countInEndSec: 2.6, source: 'mic' as const },
    };
    expect(manifestToProject(withAudio)).toEqual({
      id: '01TEST',
      kind: 'song',
      songId: 'song-1',
      name: 'Clair de Lune',
      createdAt: 1000,
      updatedAt: 1000,
      durationSec: 62.5,
      transcriptionStatus: 'none',
      hasEdits: false,
    });
  });

  it('merges app-side changes without losing folder-only fields', () => {
    const merged = mergeProjectIntoManifest(m, {
      ...manifestToProject(m),
      name: 'Renamed',
      songId: undefined,
      kind: 'idea',
      transcriptionStatus: 'done',
      updatedAt: 2000,
    });
    expect(merged.name).toBe('Renamed');
    expect(merged.kind).toBe('idea');
    expect(merged.songId).toBeUndefined();
    expect(merged.transcription.status).toBe('done');
    expect(merged.updatedAt).toBe(2000);
    expect(merged.scoreSettings).toEqual(m.scoreSettings);
  });

  it('rejects broken manifests and fills defaults for old ones', () => {
    expect(() => parseManifest('{')).toThrow(ManifestError);
    expect(() => parseManifest(JSON.stringify({ ...m, schema: 99 }))).toThrow(/schema/);
    expect(() => parseManifest(JSON.stringify({ ...m, kind: 'x' }))).toThrow(/kind/);
    const { scoreSettings: _s, transcription: _t, ...bare } = m;
    const parsed = parseManifest(JSON.stringify(bare));
    expect(parsed.transcription.status).toBe('none');
    expect(parsed.scoreSettings.timeSig).toBe('4/4');
  });
});

describe('parseEditLog', () => {
  it('clamps head to the op count', () => {
    const ops = [{ t: 'delete', noteId: 'n1' }];
    expect(parseEditLog(JSON.stringify({ ops, head: 5 })).head).toBe(1);
    expect(parseEditLog(JSON.stringify({ ops })).head).toBe(1);
    expect(parseEditLog('{}')).toEqual({ ops: [], head: 0 });
  });
});
