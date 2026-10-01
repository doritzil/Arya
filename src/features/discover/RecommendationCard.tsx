import { View } from 'react-native';

import { useLibrary } from '@/data/store';
import type { CatalogSong } from '@/data/types';
import { useIsPlaying, usePlayback, usePlaybackError, useProgress } from '@/playback/coordinator';
import { radius, space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Difficulty } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { PlayDisc } from '@/ui/PlayDisc';
import { Text } from '@/ui/Text';

/**
 * SongCard `recommendation` variant (FR-25, FR-26, FR-29, FR-30). Plays in place — the card never
 * navigates; Want to learn toggles to "Added to Learning"; ✕ removes it and counts as not interested.
 */
export function RecommendationCard({ song, dismissible = true }: { song: CatalogSong; dismissible?: boolean }) {
  const key = `song:${song.catalogId}`;
  const playing = useIsPlaying(key);
  const progress = useProgress(key);
  const error = usePlaybackError(key);
  const toggle = usePlayback((s) => s.toggle);
  const wanted = useLibrary((s) => s.songs.some((x) => x.catalogId === song.catalogId));
  const want = useLibrary((s) => s.want);
  const undoWant = useLibrary((s) => s.undoWant);
  const dismiss = useLibrary((s) => s.dismiss);

  return (
    <Glass padding={space[4]} style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={1}>
            {song.title}
          </Text>
          <Text variant="footnote" color="inkMuted" numberOfLines={1}>
            {song.artist} · {song.genre}
          </Text>
          <View style={{ marginTop: space[1] }}>
            <Difficulty level={song.difficulty} />
          </View>
        </View>
        <PlayDisc
          soft
          playing={playing}
          label={`${playing ? 'Pause' : 'Play'} ${song.title}`}
          onPress={() =>
            toggle({
              kind: 'song',
              key,
              title: song.title,
              artist: song.artist,
              appleMusicId: song.appleMusicId,
              previewUrl: song.previewUrl,
            })
          }
        />
      </View>
      {playing || progress > 0 ? <ProgressLine value={progress} /> : null}
      {error ? (
        <Text variant="footnote" color="warning" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Button
          size="small"
          variant="soft"
          icon={wanted ? 'check' : 'plus'}
          label={wanted ? 'Added to Learning' : 'Want to learn'}
          accessibilityHint={wanted ? 'Tap to remove it from your learning list' : undefined}
          onPress={() => (wanted ? undoWant(song.catalogId) : want(song))}
        />
        {song.midiUrl ? <KeysMarker /> : null}
        <View style={{ flex: 1 }} />
        {dismissible ? (
          <IconButton icon="close" size="small" label={`Not interested in ${song.title}`} onPress={() => dismiss(song.catalogId)} />
        ) : null}
      </View>
    </Glass>
  );
}

/** "Keys available" — the song's score already works in Keyboard mode (§6.6). Word + icon, never icon alone. */
export function KeysMarker() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }} accessible accessibilityLabel="Keys available">
      <Icon name="piano" size={16} color="inkMuted" />
      <Text variant="footnote" color="inkMuted">
        Keys available
      </Text>
    </View>
  );
}

export function ProgressLine({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 3, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: 3, backgroundColor: colors.accent }} />
    </View>
  );
}
