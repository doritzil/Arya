import type { CatalogSong, Genre, Level } from './types';

/**
 * Seed catalog bundled with the app so Discover works before reco-api exists and when offline on first
 * launch. Difficulty ratings are hand-curated. `midiUrl` marks public-domain pieces with curated MIDI.
 */
type Row = [title: string, artist: string, genre: Genre, level: Level, publicDomain?: true];

const ROWS: Row[] = [
  ['Clair de Lune', 'Debussy', 'Classical', 3, true],
  ['Gymnopédie No. 1', 'Satie', 'Classical', 2, true],
  ['Für Elise', 'Beethoven', 'Classical', 2, true],
  ['Prelude in E minor, Op. 28 No. 4', 'Chopin', 'Classical', 3, true],
  ['Minuet in G', 'Bach (attr. Petzold)', 'Classical', 1, true],
  ['Moonlight Sonata, 1st mvt', 'Beethoven', 'Classical', 3, true],
  ['Arabesque No. 1', 'Debussy', 'Classical', 4, true],
  ['Nocturne in E-flat, Op. 9 No. 2', 'Chopin', 'Classical', 4, true],
  ['Canon in D', 'Pachelbel', 'Classical', 2, true],
  ['Maple Leaf Rag', 'Scott Joplin', 'Jazz', 4, true],
  ['The Entertainer', 'Scott Joplin', 'Jazz', 3, true],
  ['Autumn Leaves', 'Joseph Kosma', 'Jazz', 3],
  ['Take Five', 'Dave Brubeck', 'Jazz', 4],
  ['Fly Me to the Moon', 'Bart Howard', 'Jazz', 3],
  ['Blue Monk', 'Thelonious Monk', 'Jazz', 3],
  ['River Flows in You', 'Yiruma', 'Contemporary', 2],
  ['Nuvole Bianche', 'Ludovico Einaudi', 'Contemporary', 3],
  ['Experience', 'Ludovico Einaudi', 'Contemporary', 3],
  ['Una Mattina', 'Ludovico Einaudi', 'Contemporary', 2],
  ['Kiss the Rain', 'Yiruma', 'Contemporary', 2],
  ['Married Life', 'Michael Giacchino', 'Film & TV', 3],
  ["Comptine d'un autre été", 'Yann Tiersen', 'Film & TV', 3],
  ['Interstellar Main Theme', 'Hans Zimmer', 'Film & TV', 2],
  ["Hedwig's Theme", 'John Williams', 'Film & TV', 3],
  ['Game of Thrones Theme', 'Ramin Djawadi', 'Film & TV', 2],
  ['Mia & Sebastian’s Theme', 'Justin Hurwitz', 'Film & TV', 3],
  ['Someone Like You', 'Adele', 'Pop', 2],
  ['All of Me', 'John Legend', 'Pop', 2],
  ['Perfect', 'Ed Sheeran', 'Pop', 1],
  ['Let It Be', 'The Beatles', 'Pop', 1],
  ['A Thousand Years', 'Christina Perri', 'Pop', 2],
  ['Imagine', 'John Lennon', 'Pop', 1],
  ['Hello', 'Oasis', 'Rock', 2],
  ['Bohemian Rhapsody', 'Queen', 'Rock', 4],
  ['Don’t Stop Believin’', 'Journey', 'Rock', 2],
  ['Clocks', 'Coldplay', 'Rock', 2],
  ['Piano Man', 'Billy Joel', 'Rock', 3],
  ['November Rain', "Guns N' Roses", 'Rock', 3],
  ['If I Ain’t Got You', 'Alicia Keys', 'R&B', 3],
  ['Ordinary People', 'John Legend', 'R&B', 3],
  ['Lovely Day', 'Bill Withers', 'R&B', 2],
  ['Isn’t She Lovely', 'Stevie Wonder', 'R&B', 3],
  ['Superstition', 'Stevie Wonder', 'R&B', 3],
  ['Amazing Grace', 'Traditional', 'Worship', 1, true],
  ['How Great Thou Art', 'Traditional', 'Worship', 2, true],
  ['Be Thou My Vision', 'Traditional', 'Worship', 1, true],
  ['10,000 Reasons', 'Matt Redman', 'Worship', 2],
  ['Oceans', 'Hillsong United', 'Worship', 2],
  ['What a Friend We Have in Jesus', 'Charles Converse', 'Worship', 1, true],
  ['City of Stars', 'Justin Hurwitz', 'Musicals', 2],
  ['Memory', 'Andrew Lloyd Webber', 'Musicals', 3],
  ['Defying Gravity', 'Stephen Schwartz', 'Musicals', 3],
  ['On My Own', 'Claude-Michel Schönberg', 'Musicals', 2],
  ['Megalovania', 'Toby Fox', 'Video games', 3],
  ['Zelda’s Lullaby', 'Koji Kondo', 'Video games', 1],
  ['Aerith’s Theme', 'Nobuo Uematsu', 'Video games', 2],
  ['Sweden', 'C418', 'Video games', 1],
  ['Merry-Go-Round of Life', 'Joe Hisaishi', 'Anime', 3],
  ['One Summer’s Day', 'Joe Hisaishi', 'Anime', 2],
  ['Unravel', 'TK from Ling tosite sigure', 'Anime', 4],
  ['Summer', 'Joe Hisaishi', 'Anime', 3],
  ['Dynamite', 'BTS', 'K-pop', 2],
  ['Spring Day', 'BTS', 'K-pop', 3],
  ['Butterfly', 'BTS', 'K-pop', 3],
  ['Snowman', 'Sia', 'Lo-fi', 1],
  ['Coffee', 'beabadoobee', 'Lo-fi', 1],
  ['Snowfall', 'Øneheart', 'Lo-fi', 1],
  ['Holocene', 'Bon Iver', 'Indie', 2],
  ['Skinny Love', 'Bon Iver', 'Indie', 2],
  ['Mystery of Love', 'Sufjan Stevens', 'Indie', 2],
  ['Motion Sickness', 'Phoebe Bridgers', 'Indie', 2],
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const SEED_CATALOG: CatalogSong[] = ROWS.map(([title, artist, genre, difficulty, pd]) => {
  const catalogId = `${slug(title)}--${slug(artist)}`;
  return {
    catalogId,
    title,
    artist,
    genre,
    difficulty,
    durationSec: 150 + ((title.length * 37) % 180),
    ...(pd ? { midiUrl: `catalog-midi/${catalogId}.mid` } : null),
  };
});
