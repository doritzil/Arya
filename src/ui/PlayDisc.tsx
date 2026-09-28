import { Pressable, View } from 'react-native';

import { radius, useTheme } from '@/theme';

import { Icon } from './Icon';

export interface PlayDiscProps {
  playing: boolean;
  onPress?: () => void;
  /** VoiceOver name, e.g. "Play River Flows in You". */
  label: string;
  size?: 'small' | 'large';
  /** soft = glass disc used inside song cards; otherwise the dark primary disc. */
  soft?: boolean;
}

export function PlayDisc({ playing, onPress, label, size = 'small', soft }: PlayDiscProps) {
  const { colors, shadows } = useTheme();
  const d = size === 'large' ? 88 : 44;
  const disc = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={size === 'small' ? 4 : 0}
      style={({ pressed }) => [
        {
          width: d,
          height: d,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: soft ? colors.glassStrong : colors.primary,
          opacity: pressed ? 0.85 : 1,
        },
        soft ? { borderWidth: 1, borderColor: colors.glassEdge, ...shadows.knob } : shadows.disc,
      ]}>
      <Icon name={playing ? 'pause' : 'play'} size={size === 'large' ? 34 : 20} color={soft ? 'ink' : 'onPrimary'} />
    </Pressable>
  );
  if (size !== 'large') return disc;
  // The large disc sits in an 8pt glass halo.
  return <View style={{ padding: 8, borderRadius: radius.pill, backgroundColor: colors.glass }}>{disc}</View>;
}
