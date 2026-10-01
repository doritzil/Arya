import { Pressable, View } from 'react-native';

import type { SongStatus } from '@/data/types';
import { radius, space, useTheme, type ColorName } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/** Toggle chip for picking liked genres (FR-24). Selected = dark pill with a check. */
export function GenreChip({
  label,
  selected,
  onPress,
  compact,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        minHeight: compact ? 36 : 40,
        paddingHorizontal: compact ? space[3] : space[4],
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.lineStrong,
        backgroundColor: selected ? colors.primary : colors.glassStrong,
        opacity: pressed ? 0.85 : 1,
      })}>
      {selected ? <Icon name="check" size={16} color="onPrimary" /> : null}
      <Text variant="callout" weight={selected ? 600 : 400} color={selected ? 'onPrimary' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

const PILL: Record<SongStatus, { label: string; bg: ColorName; fg: ColorName; icon?: IconName }> = {
  recommended: { label: 'For you', bg: 'primarySoft', fg: 'ink' },
  learning: { label: 'Learning', bg: 'accentSoft', fg: 'accent' },
  learned: { label: 'Learned', bg: 'successSoft', fg: 'success', icon: 'check' },
  idea: { label: 'Idea', bg: 'warningSoft', fg: 'warning', icon: 'wave' },
};

/** Where a song is in the loop. Always a word, never a bare dot. */
export function StatusPill({ status }: { status: SongStatus }) {
  const { colors } = useTheme();
  const p = PILL[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        height: 24,
        paddingHorizontal: space[2],
        borderRadius: radius.pill,
        backgroundColor: colors[p.bg],
      }}>
      {p.icon ? <Icon name={p.icon} size={14} color={p.fg} /> : null}
      <Text variant="caption" color={p.fg} style={{ textTransform: 'uppercase' }}>
        {p.label}
      </Text>
    </View>
  );
}

const LEVELS = ['Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert'] as const;
export type Level = 1 | 2 | 3 | 4 | 5;
export const levelName = (l: Level) => LEVELS[l - 1];

/** Piano difficulty: 1–5 dots plus the level word (FR-25). */
export function Difficulty({ level }: { level?: Level }) {
  const { colors } = useTheme();
  // Songs found on Apple Music have no curated level yet — say so rather than guess.
  if (!level) {
    return (
      <Text variant="footnote" color="inkMuted" accessibilityLabel="Difficulty not rated yet">
        Level not rated yet
      </Text>
    );
  }
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}
      accessible
      accessibilityLabel={`Difficulty: ${levelName(level)}`}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              borderWidth: 1.25,
              borderColor: colors.accent,
              backgroundColor: i <= level ? colors.accent : 'transparent',
            }}
          />
        ))}
      </View>
      <Text variant="footnote" color="inkMuted">
        {levelName(level)}
      </Text>
    </View>
  );
}

/** Segmented pill: Original · Recordings · My notes (FR-32), or Recording · Piano (FR-16). */
export function SourceSwitch({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: radius.pill,
        backgroundColor: colors.glass,
        borderWidth: 1,
        borderColor: colors.glassEdge,
      }}>
      {options.map((o, i) => {
        const on = i === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? colors.primary : 'transparent',
            }}>
            <Text variant="callout" weight={on ? 600 : 400} color={on ? 'onPrimary' : 'inkMuted'}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
