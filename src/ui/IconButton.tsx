import { Pressable } from 'react-native';

import { radius, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

export interface IconButtonProps {
  icon: IconName;
  /** Required — this is the VoiceOver name. */
  label: string;
  onPress?: () => void;
  pressed?: boolean;
  size?: 'default' | 'small';
  /** false inside a card that is already glass. */
  glass?: boolean;
  disabled?: boolean;
}

/** Round icon-only button: back, favourite, dismiss, repeat. */
export function IconButton({ icon, label, onPress, pressed, size = 'default', glass = true, disabled }: IconButtonProps) {
  const { colors, shadows } = useTheme();
  const d = size === 'small' ? 40 : 48;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={pressed === undefined ? { disabled } : { selected: pressed, disabled }}
      hitSlop={size === 'small' ? 4 : 0}
      style={({ pressed: down }) => [
        {
          width: d,
          height: d,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : down ? 0.8 : 1,
        },
        glass && { backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassEdge, ...shadows.knob },
        pressed && { backgroundColor: colors.accentSoft },
      ]}>
      <Icon
        name={icon}
        size={size === 'small' ? 20 : 22}
        color={pressed ? 'accent' : 'ink'}
        weight={pressed && icon === 'heart' ? 'fill' : undefined}
        warm={pressed}
      />
    </Pressable>
  );
}
