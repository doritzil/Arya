import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { keyboardAvailability, takesFor, useLibrary } from '@/data/store';
import type { Song } from '@/data/types';
import { formatShortDate, isToday } from '@/lib/format';
import { space, useTheme } from '@/theme';
import { Difficulty, StatusPill } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

/** SongCard with action `open`: the whole card links to the song page (FR-33). */
export function LearningCard({ song }: { song: Song }) {
  const { colors, shadows } = useTheme();
  const projects = useLibrary((s) => s.projects);
  const takes = takesFor(projects, song.id).length;
  const keys = keyboardAvailability(song, projects).state;
  const added = isToday(song.addedAt) ? 'Added today' : `Added ${formatShortDate(song.addedAt)}`;
  const takesLabel = takes === 0 ? 'No takes yet' : takes === 1 ? '1 take' : `${takes} takes`;
  return (
    <Pressable
      onPress={() => router.push(`/learning/${song.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${song.title}, ${song.artist}. ${song.status === 'learned' ? 'Learned' : 'Learning'}. ${added}, ${takesLabel}.`}>
      <Glass padding={space[4]} style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" numberOfLines={1}>
              {song.title}
            </Text>
            <Text variant="footnote" color="inkMuted" numberOfLines={1}>
              {song.artist} · {song.genre}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[1] }}>
              <StatusPill status={song.status} />
              <Difficulty level={song.difficulty} />
            </View>
          </View>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.glassStrong,
              borderWidth: 1,
              borderColor: colors.glassEdge,
              alignItems: 'center',
              justifyContent: 'center',
              ...shadows.knob,
            }}>
            <Icon name="chevron-right" size={18} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="footnote" color="inkMuted" style={{ flex: 1 }}>
            {added} · {takesLabel}
          </Text>
          {keys === 'score' || keys === 'myNotes' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
              <Icon name="piano" size={16} color="inkMuted" />
              <Text variant="footnote" color="inkMuted">
                Keys ready
              </Text>
            </View>
          ) : null}
        </View>
      </Glass>
    </Pressable>
  );
}
