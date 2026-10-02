import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { takeFiles } from '@/features/record/takeFiles';
import { keyboardAvailability, takesFor, useLibrary } from '@/data/store';
import { KeyboardModeRow } from '@/features/learning/KeyboardModeRow';
import { NotesSheet } from '@/features/learning/NotesSheet';
import { NowPlaying } from '@/features/learning/NowPlaying';
import { useNotesEntry } from '@/features/notes/notesStore';
import { useProjectScore } from '@/features/notes/useProjectScore';
import { confirmRemoveSong } from '@/lib/confirm';
import { formatShortDate, formatTime, weeksSince } from '@/lib/format';
import type { Source } from '@/playback/coordinator';
import { space } from '@/theme';
import { Button } from '@/ui/Button';
import { SourceSwitch } from '@/ui/Chips';
import { IconButton } from '@/ui/IconButton';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const SOURCES = ['Original', 'Recordings', 'My notes'] as const;

export default function SongPage() {
  const { songId } = useLocalSearchParams<{ songId: string }>();
  const song = useLibrary((s) => s.songs.find((x) => x.id === songId));
  const projects = useLibrary((s) => s.projects);
  const toggleFavourite = useLibrary((s) => s.toggleFavourite);
  const markLearned = useLibrary((s) => s.markLearned);
  const removeSong = useLibrary((s) => s.removeSong);
  const [tab, setTab] = useState(0);

  const takes = song ? takesFor(projects, song.id) : [];
  const take = takes[0];
  const notesTake = takes.find((p) => p.transcriptionStatus === 'done');
  // Same settings + edits as Your notes, so both show the same score.
  const entry = useNotesEntry(notesTake?.id ?? '');
  const score = useProjectScore(tab === 2 ? notesTake?.id : undefined, entry.settings, entry.edits);

  if (!song) {
    return (
      <Screen tabBar>
        <TopBar />
        <Text variant="title2">This song is no longer on your list.</Text>
      </Screen>
    );
  }

  // FR-32: Original · Recordings · My notes. The switch only appears once there's a recording.
  const source = takes.length ? SOURCES[tab] : 'Original';
  let player: { eyebrow: string; subtitle: string; source: Source; duration: number; visual?: React.ReactNode };
  if (source === 'Recordings' && take) {
    player = {
      eyebrow: `Recording · ${formatShortDate(take.createdAt)}, ${formatTime(take.createdAt)}`,
      subtitle: 'Your take',
      source: { kind: 'recording', key: `rec:${take.id}`, title: song.title, uri: takeFiles.audioUri(take.id) },
      duration: take.durationSec,
    };
  } else if (source === 'My notes' && notesTake) {
    player = {
      eyebrow: `My notes · ${formatShortDate(notesTake.createdAt)} recording`,
      subtitle: 'Played on piano',
      source: { kind: 'synth', key: `synth:${notesTake.id}`, title: song.title, notes: score?.synthNotes ?? [] },
      duration: score?.durationSec ?? notesTake.durationSec,
      visual: <NotesSheet projectId={notesTake.id} score={score} sourceKey={`synth:${notesTake.id}`} />,
    };
  } else {
    player = {
      eyebrow: `Original · ${song.artist}`,
      subtitle: 'Apple Music',
      source: {
        kind: 'song',
        key: `song:${song.catalogId ?? song.id}`,
        title: song.title,
        artist: song.artist,
        appleMusicId: song.appleMusicId,
        previewUrl: song.previewUrl,
      },
      duration: song.durationSec ?? 30,
    };
  }

  const availability = keyboardAvailability(song, projects, source === 'Original' ? undefined : notesTake?.id);
  const learned = song.status === 'learned';

  return (
    <Screen tabBar>
      <TopBar
        title={learned ? 'Learned' : `Learning · week ${weeksSince(song.addedAt)}`}
        right={
          <IconButton
            icon="heart"
            label={song.favourite ? 'Remove from favourites' : 'Add to favourites'}
            pressed={song.favourite}
            onPress={() => toggleFavourite(song.id)}
          />
        }
      />
      {takes.length ? (
        <View style={{ marginBottom: space[4] }}>
          <SourceSwitch options={[...SOURCES]} value={tab} onChange={setTab} />
        </View>
      ) : null}
      <NowPlaying
        eyebrow={player.eyebrow}
        title={song.title}
        subtitle={player.subtitle}
        source={player.source}
        fallbackDuration={player.duration}
        seed={song.title.length * 13 + tab}
        visual={player.visual}
      />
      <View style={{ gap: space[3], marginTop: space[6] }}>
        <KeyboardModeRow song={song} availability={availability} />
        <View style={{ flexDirection: 'row', gap: space[3] }}>
          <Button
            label="Record"
            icon="mic"
            variant="secondary"
            onPress={() => router.push({ pathname: '/take/get-ready', params: { songId: song.id } })}
          />
          {learned ? null : (
            <Button
              label="Mark as learned"
              icon="check"
              style={{ flex: 1 }}
              onPress={() => {
                markLearned(song.id);
                router.back();
              }}
            />
          )}
        </View>
        <Button
          label={learned ? 'Remove from Library' : 'Remove from Learning'}
          icon="trash"
          variant="ghost"
          size="small"
          style={{ alignSelf: 'center' }}
          onPress={async () => {
            if (!(await confirmRemoveSong(song.title, takes.length))) return;
            router.back();
            removeSong(song.id);
          }}
        />
      </View>
    </Screen>
  );
}
