import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { takeFiles } from '@/features/record/takeFiles';
import { useLibrary } from '@/data/store';
import type { Project } from '@/data/types';
import { formatDuration, formatShortDate, formatTime } from '@/lib/format';
import { useIsPlaying, usePlayback } from '@/playback/coordinator';
import { space } from '@/theme';
import { StatusPill } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { PlayDisc } from '@/ui/PlayDisc';
import { Text } from '@/ui/Text';


/** A recording on the Recordings list: tap the card → Your notes; the disc plays the take in place. */
export function RecordingCard({ project }: { project: Project }) {
  const song = useLibrary((s) => (project.songId ? s.songs.find((x) => x.id === project.songId) : undefined));
  const key = `rec:${project.id}`;
  const playing = useIsPlaying(key);
  const toggle = usePlayback((s) => s.toggle);
  const title = project.name.split(' — ')[0] ?? project.name;
  const status = project.kind === 'idea' ? 'idea' : song?.status === 'learned' ? 'learned' : 'learning';
  const notes =
    project.transcriptionStatus === 'done'
      ? 'notes ready'
      : project.transcriptionStatus === 'running' || project.transcriptionStatus === 'queued'
        ? `writing notes… ${Math.round((project.transcriptionProgress ?? 0) * 100)}%`
        : project.transcriptionStatus === 'failed'
          ? "notes didn't work — tap to retry"
          : 'no notes yet';

  // The card and the play disc are siblings, not nested buttons, so VoiceOver can reach both.
  return (
    <Glass padding={space[4]} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Pressable
        style={{ flex: 1, gap: 2 }}
        onPress={() => router.push(`/record/${project.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${formatShortDate(project.createdAt)} ${formatTime(project.createdAt)}, ${formatDuration(project.durationSec)}, ${notes}`}
        accessibilityHint="Opens your notes">
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="footnote" color="inkMuted">
          {formatShortDate(project.createdAt)}, {new Date(project.createdAt).getFullYear()} · {formatTime(project.createdAt)}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: space[1] }}>
          <StatusPill status={status} />
        </View>
        <Text variant="footnote" color="inkMuted" style={{ marginTop: space[1] }}>
          {formatDuration(project.durationSec)} · {notes}
        </Text>
      </Pressable>
      <PlayDisc
        soft
        playing={playing}
        label={`${playing ? 'Pause' : 'Play'} ${title}`}
        onPress={() => toggle({ kind: 'recording', key, title, uri: takeFiles.audioUri(project.id) })}
      />
    </Glass>
  );
}
