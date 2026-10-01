import { findOnAppleMusic, searchAppleMusic, songKey } from './appleMusic';

const track = (id: number, trackName: string, artistName: string, genre = 'Rock', preview = true) => ({
  wrapperType: 'track',
  kind: 'song',
  trackId: id,
  trackName,
  artistName,
  primaryGenreName: genre,
  trackTimeMillis: 200_000,
  ...(preview ? { previewUrl: `https://audio.example/${id}.m4a` } : null),
});

const respond = (results: unknown[]) =>
  jest.fn().mockResolvedValue({ ok: true, json: async () => ({ resultCount: results.length, results }) });

const setFetch = (fn: jest.Mock) => {
  globalThis.fetch = fn as unknown as typeof fetch;
};

afterEach(() => jest.restoreAllMocks());

describe('searchAppleMusic', () => {
  it('maps tracks to playable catalog songs without a difficulty', async () => {
    setFetch(respond([track(1, 'Wonderwall', 'Oasis'), track(2, 'Soundtrack Song', 'Composer', 'Soundtrack')]));
    const out = await searchAppleMusic('oasis', { country: 'GB' });
    expect(out[0]).toEqual({
      catalogId: 'am-1',
      appleMusicId: '1',
      title: 'Wonderwall',
      artist: 'Oasis',
      genre: 'Rock',
      previewUrl: 'https://audio.example/1.m4a',
      durationSec: 200,
    });
    expect(out[0]?.difficulty).toBeUndefined();
    expect(out[1]?.genre).toBe('Film & TV');
    expect((globalThis.fetch as unknown as jest.Mock).mock.calls[0][0]).toContain('country=GB');
  });

  it('collapses live / remastered versions of the same song', async () => {
    setFetch(
      respond([
        track(1, 'Hello', 'Oasis'),
        track(2, 'Hello (Live at Knebworth)', 'Oasis'),
        track(3, 'Hello (Remastered)', 'Oasis'),
        track(4, 'Hello', 'Adele', 'Pop'),
      ]),
    );
    const out = await searchAppleMusic('hello');
    expect(out.map((s) => `${s.title}/${s.artist}`)).toEqual(['Hello/Oasis', 'Hello/Adele']);
  });

  it('primes the playback lookup so play needs no second request', async () => {
    setFetch(respond([track(7, 'Champagne Supernova', 'Oasis')]));
    await searchAppleMusic('supernova', { country: 'US' });
    const match = await findOnAppleMusic('Champagne Supernova', 'Oasis', 'US');
    expect(match?.appleMusicId).toBe('7');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when Apple Music is unreachable', async () => {
    setFetch(jest.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(searchAppleMusic('x')).rejects.toThrow('503');
  });
});

it('songKey ignores accents, case and punctuation', () => {
  expect(songKey('Gymnopédie No. 1', 'Satie')).toBe(songKey('gymnopedie no 1', 'SATIE'));
});
