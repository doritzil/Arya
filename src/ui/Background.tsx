import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * The screen ground: peach → pink → peach linear gradient with a lilac glow from the bottom-left
 * (AriaBackground in AriaTheme.swift). Mounted once behind the navigator.
 */
export function Background() {
  const { colors, scheme } = useTheme();
  // Ids must be unique per scheme: on web every SVG shares one document, and a forced-dark screen
  // (Keyboard mode) can mount while the light gradient is still defined underneath.
  const lin = `aria-lin-${scheme}`;
  const glow = `aria-glow-${scheme}`;
  // Explicit pixel size from layout: with "100%" the native SVG view keeps its first size, so after a
  // rotation (Keyboard mode is landscape) the gradient covered only the old portrait width.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
      }}>
      {size ? (
        <Svg key={`${size.w}x${size.h}`} width={size.w} height={size.h} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={lin} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.gradPeach} />
              <Stop offset="0.55" stopColor={colors.gradPink} />
              <Stop offset="1" stopColor={colors.gradPeach} />
            </LinearGradient>
            <RadialGradient id={glow} cx="0" cy="0.72" rx="1.08" ry="0.5" fx="0" fy="0.72">
              <Stop offset="0" stopColor={colors.gradLilac} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.gradLilac} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${lin})`} />
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${glow})`} />
        </Svg>
      ) : null}
    </View>
  );
}
