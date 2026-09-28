import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { formatClock } from '@/lib/format';
import { radius, useTheme } from '@/theme';

import { Text } from './Text';

/** Scrubber with times (FR-31). Drag or tap to seek; VoiceOver adjusts in 5-second steps. */
export function Scrubber({
  position,
  duration,
  onSeek,
  showTimes = true,
}: {
  position: number;
  duration: number;
  onSeek: (sec: number) => void;
  showTimes?: boolean;
}) {
  const { colors, shadows } = useTheme();
  const [width, setWidth] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? position;
  const frac = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;
  const at = (x: number) => Math.min(1, Math.max(0, x / width)) * duration;

  return (
    <View>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width || 1)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Position"
        accessibilityValue={{ text: `${formatClock(shown)} of ${formatClock(duration)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onSeek(position + (e.nativeEvent.actionName === 'increment' ? 5 : -5))}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setDrag(at(e.nativeEvent.locationX))}
        onResponderMove={(e) => setDrag(at(e.nativeEvent.locationX))}
        onResponderRelease={(e) => {
          onSeek(at(e.nativeEvent.locationX));
          setDrag(null);
        }}
        onResponderTerminate={() => setDrag(null)}
        style={{ height: 28, justifyContent: 'center' }}>
        <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: colors.track }} pointerEvents="none">
          <View style={{ width: `${frac * 100}%`, height: 4, borderRadius: radius.pill, backgroundColor: colors.primary }} />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: frac * width - 10,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.keyWhite,
            ...shadows.knob,
          }}
        />
      </View>
      {showTimes ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="callout" color="inkMuted" style={{ fontVariant: ['tabular-nums'] }}>
            {formatClock(shown)}
          </Text>
          <Text variant="callout" color="inkMuted" style={{ fontVariant: ['tabular-nums'] }}>
            {formatClock(duration)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
