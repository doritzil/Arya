import { useState } from 'react';
import { View } from 'react-native';

import { radius, space, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

const MIN = 0.4;
const MAX = 1.2;
const STEP = 0.05;
const H = 150;

/** Vertical speed slider, 40–120 %, snapping to 5 % steps. Always shows the number. */
export function SpeedSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors, shadows } = useTheme();
  const [drag, setDrag] = useState<number | null>(null);
  const v = drag ?? value;
  const frac = (v - MIN) / (MAX - MIN);
  const at = (y: number) => {
    const raw = MAX - Math.min(1, Math.max(0, y / H)) * (MAX - MIN);
    return Math.round(raw / STEP) * STEP;
  };
  const pct = `${Math.round(v * 100)}%`;
  return (
    <View style={{ alignItems: 'center', gap: space[2] }}>
      <Icon name="speed" size={22} color="inkMuted" />
      <Text variant="headline">{pct}</Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Speed"
        accessibilityValue={{ text: pct }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onChange(Math.min(MAX, Math.max(MIN, value + (e.nativeEvent.actionName === 'increment' ? STEP : -STEP))))
        }
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setDrag(at(e.nativeEvent.locationY))}
        onResponderMove={(e) => setDrag(at(e.nativeEvent.locationY))}
        onResponderRelease={(e) => {
          onChange(at(e.nativeEvent.locationY));
          setDrag(null);
        }}
        style={{ width: 44, height: H, alignItems: 'center' }}>
        <View pointerEvents="none" style={{ width: 4, height: H, borderRadius: radius.pill, backgroundColor: colors.track }} />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: (1 - frac) * H - 12,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.keyWhite,
            ...shadows.knob,
          }}
        />
      </View>
      <Text variant="footnote" color="inkMuted">
        Speed
      </Text>
    </View>
  );
}
