import { View } from 'react-native';

import { radius, space, useTheme } from '@/theme';

import { Icon } from './Icon';
import { Text } from './Text';

const BARS = 24;

/** Live mic level with too-quiet / too-loud warnings (FR-2). A warning always says what to do. */
export function LevelMeter({ level, warning }: { level: number; warning: 'quiet' | 'clipping' | null }) {
  const { colors } = useTheme();
  const on = Math.round(Math.min(1, Math.max(0, level)) * BARS);
  return (
    <View style={{ gap: space[2] }}>
      <View
        accessible
        accessibilityLabel={`Input level ${Math.round(level * 100)} percent`}
        style={{
          flexDirection: 'row',
          gap: 3,
          height: 28,
          alignItems: 'flex-end',
          paddingHorizontal: space[2],
          paddingVertical: space[1],
          borderRadius: radius.pill,
          backgroundColor: colors.glass,
          borderWidth: 1,
          borderColor: colors.glassEdge,
        }}>
        {Array.from({ length: BARS }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: i < on ? '100%' : '30%',
              borderRadius: 2,
              backgroundColor: i < on ? (i >= BARS - 3 ? colors.warning : colors.accent) : colors.track,
            }}
          />
        ))}
      </View>
      {warning ? (
        <View
          accessibilityLiveRegion="assertive"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            padding: space[3],
            borderRadius: radius.md,
            backgroundColor: colors.warningSoft,
          }}>
          <Icon name="alert" size={18} color="warning" />
          <Text variant="footnote" color="warning" style={{ flex: 1 }}>
            {warning === 'quiet'
              ? 'Too quiet — move the phone closer to the piano.'
              : 'Too loud — move the phone further from the piano.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
