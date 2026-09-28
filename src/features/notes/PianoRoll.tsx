import type { ScoreNote } from '@aria/score-engine';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

const LANE = 9;
const PX_PER_BEAT = 36;

/** Piano-roll view of the notes (FR-17): C rows labelled, current notes glow, the rest at half strength. */
export function PianoRoll({
  notes,
  currentIds,
  onTapNote,
}: {
  notes: ScoreNote[];
  currentIds: Set<string>;
  onTapNote?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { low, high, beats } = useMemo(() => {
    if (!notes.length) return { low: 48, high: 72, beats: 8 };
    const lo = Math.min(...notes.map((n) => n.pitch)) - 2;
    const hi = Math.max(...notes.map((n) => n.pitch)) + 2;
    return { low: lo, high: hi, beats: Math.max(8, ...notes.map((n) => n.beat + n.beats)) };
  }, [notes]);
  const h = (high - low + 1) * LANE;
  return (
    <View style={{ flexDirection: 'row', borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
      <View style={{ width: 30, height: h }}>
        {Array.from({ length: high - low + 1 }, (_, i) => high - i)
          .filter((p) => p % 12 === 0)
          .map((p) => (
            <Text key={p} variant="caption" color="inkMuted" style={{ position: 'absolute', top: (high - p) * LANE - 4, left: 4, fontSize: 9 }}>
              C{Math.floor(p / 12) - 1}
            </Text>
          ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: beats * PX_PER_BEAT, height: h }}>
          {Array.from({ length: high - low + 1 }, (_, i) => high - i)
            .filter((p) => p % 12 === 0)
            .map((p) => (
              <View key={p} style={{ position: 'absolute', left: 0, right: 0, top: (high - p) * LANE + LANE - 1, height: 1, backgroundColor: colors.line }} />
            ))}
          {notes.map((n) => {
            const on = currentIds.has(n.id);
            return (
              <View
                key={n.id}
                onTouchEnd={() => onTapNote?.(n.id)}
                accessibilityLabel={`${n.name}, beat ${Math.round(n.beat * 10) / 10 + 1}`}
                style={{
                  position: 'absolute',
                  left: n.beat * PX_PER_BEAT,
                  width: Math.max(4, n.beats * PX_PER_BEAT - 2),
                  top: (high - n.pitch) * LANE,
                  height: LANE - 1,
                  borderRadius: 3,
                  backgroundColor: on ? colors.peach : colors.note,
                  opacity: on ? 1 : 0.5,
                }}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
