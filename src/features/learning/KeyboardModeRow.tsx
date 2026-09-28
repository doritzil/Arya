import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { KeyboardAvailability, Song } from '@/data/types';
import { formatShortDate } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { IconTile } from '@/ui/IconTile';
import { Text } from '@/ui/Text';

/**
 * Song page → Keyboard mode entry in its four states (ARCHITECTURE §6.6, Keyboard mode states design):
 * locked → taps through to Get ready; on the way → Turning it into notes; from your notes; from the score.
 * Locked is dimmed but still a real button, with words — never opacity alone.
 */
export function KeyboardModeRow({ song, availability }: { song: Song; availability: KeyboardAvailability }) {
  const { colors } = useTheme();
  const a = availability;
  const content = {
    locked: {
      icon: 'mic' as const,
      subtitle: 'Record yourself to see it on the keys',
      a11y: 'Keyboard mode. Record yourself to see this song on the keys.',
      go: () => router.push({ pathname: '/take/get-ready', params: { songId: song.id } }),
    },
    onTheWay: {
      icon: 'hourglass' as const,
      subtitle: 'Your notes are on the way…',
      a11y: 'Keyboard mode. Your notes are on the way.',
      go: () => a.state === 'onTheWay' && router.push({ pathname: '/take/transcribing', params: { projectId: a.projectId } }),
    },
    myNotes: {
      icon: 'piano' as const,
      subtitle: a.state === 'myNotes' ? `From your ${formatShortDate(a.createdAt)} recording` : '',
      a11y: 'Keyboard mode, from your recording.',
      go: () => a.state === 'myNotes' && router.push(`/keyboard/project:${a.projectId}`),
    },
    score: {
      icon: 'piano' as const,
      subtitle: 'Watch the piece fall onto the keys',
      a11y: 'Keyboard mode, from the score. Played on piano.',
      go: () => router.push(`/keyboard/score:${song.id}`),
    },
  }[a.state];
  const locked = a.state === 'locked';

  return (
    <Pressable onPress={content.go} accessibilityRole="button" accessibilityLabel={content.a11y}>
      <Glass
        padding={space[4]}
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: space[3] },
          locked && { borderStyle: 'dashed', borderColor: colors.lineStrong, borderWidth: 1.5, backgroundColor: colors.glass },
        ]}>
        <IconTile icon={content.icon} dim={locked} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" color={locked ? 'inkMuted' : 'ink'}>
            Keyboard mode
          </Text>
          <Text variant="footnote" color="inkMuted">
            {content.subtitle}
          </Text>
          {a.state === 'onTheWay' ? (
            <View style={{ height: 3, marginTop: space[1], borderRadius: radius.pill, backgroundColor: colors.track }}>
              <View
                style={{
                  width: `${Math.round(a.progress * 100)}%`,
                  height: 3,
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          ) : null}
        </View>
        <Icon name="chevron-right" size={18} color={locked ? 'inkMuted' : 'ink'} />
      </Glass>
    </Pressable>
  );
}
