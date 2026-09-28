import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useTheme, type ColorName } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** primary: the one dark action per screen · secondary: glass + outline · soft: main action inside a card · ghost: low-stakes text. */
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost';
  size?: 'default' | 'small';
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  icon,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors, shadows } = useTheme();
  const small = size === 'small';
  const look: Record<typeof variant, { bg: string; fg: ColorName; border?: string; shadow?: ViewStyle }> = {
    primary: { bg: colors.primary, fg: 'onPrimary', shadow: shadows.disc },
    secondary: { bg: colors.glassStrong, fg: 'ink', border: colors.lineStrong },
    soft: { bg: colors.primarySoft, fg: 'ink' },
    ghost: { bg: 'transparent', fg: 'accent' },
  };
  const l = look[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={small ? 4 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: small ? 40 : 52,
          paddingHorizontal: small ? space[3] : space[4],
          gap: small ? space[1] : space[2],
          backgroundColor: l.bg,
          borderColor: l.border ?? 'transparent',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        !disabled && l.shadow,
        style,
      ]}>
      {icon ? <Icon name={icon} size={small ? 18 : 20} color={l.fg} /> : null}
      <View>
        <Text variant={small ? 'callout' : 'headline'} weight={600} color={l.fg} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
