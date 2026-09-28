import { useMemo } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

/** Deterministic pseudo-random bar heights so each song has its own shape. */
export function wavePeaks(seed: number, bars: number): number[] {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: bars }, (_, i) => {
    const x = i / (bars - 1);
    const envelope = Math.sin(Math.PI * x) ** 0.8; // quiet edges, full middle
    return Math.max(0.06, envelope * (0.35 + 0.65 * rnd()));
  });
}

/**
 * The glowing bar waveform — the app's signature image. Played part at full strength, the rest at
 * half. Drawn in `wave` straight on the gradient. `peaks` come from the audio (waveform.json); without
 * them a seeded shape is used.
 */
export function Waveform({
  progress = 0,
  height = 96,
  bars = 56,
  seed = 1,
  peaks,
  label,
}: {
  progress?: number;
  height?: number;
  bars?: number;
  seed?: number;
  peaks?: number[];
  label?: string;
}) {
  const { colors } = useTheme();
  const values = useMemo(() => peaks ?? wavePeaks(seed, bars), [peaks, seed, bars]);
  const playedUntil = Math.round(progress * values.length);
  return (
    <View
      style={{ height, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      accessible={!!label}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: Math.max(3, v * height),
            borderRadius: 2,
            backgroundColor: colors.wave,
            opacity: i < playedUntil ? 1 : 0.5,
            shadowColor: colors.wave,
            shadowOpacity: i < playedUntil ? 0.9 : 0,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ))}
    </View>
  );
}
