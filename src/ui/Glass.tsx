import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius as radii, useTheme } from '@/theme';

export interface GlassProps {
  /**
   * `blur` is a real backdrop blur (tab bar, sheets, hero cards). `flat` is the translucent glass
   * fill without blur, for cards inside scrolling lists (ARCHITECTURE §6.3).
   */
  variant?: 'blur' | 'flat';
  strong?: boolean;
  radius?: number;
  padding?: number;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Glass({
  variant = 'flat',
  strong,
  radius = radii.lg,
  padding,
  shadow = true,
  style,
  children,
}: GlassProps) {
  const { colors, shadows, scheme, reduceTransparency } = useTheme();
  const fill = reduceTransparency ? colors.surfaceRaised : strong ? colors.glassStrong : colors.glass;
  const frame: ViewStyle = {
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: reduceTransparency ? colors.line : colors.glassEdge,
    padding,
    ...(shadow ? shadows.card : null),
  };
  if (variant === 'blur' && !reduceTransparency) {
    return (
      <View style={[frame, style]}>
        <BlurView
          intensity={40}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
        />
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: fill }]} />
        {children}
      </View>
    );
  }
  return <View style={[frame, { backgroundColor: fill }, style]}>{children}</View>;
}
