import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useLibrary } from '@/data/store';
import type { Level } from '@/data/types';
import { Progress } from '@/features/onboarding/Progress';
import { radius, space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Difficulty } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const OPTIONS: { level: Level; label: string }[] = [
  { level: 1, label: 'Just starting out' },
  { level: 2, label: 'A year or two' },
  { level: 3, label: 'A few years — I read music' },
  { level: 4, label: 'I play a lot' },
];

export default function YourLevel() {
  const { colors } = useTheme();
  const level = useLibrary((s) => s.prefs.level);
  const setPrefs = useLibrary((s) => s.setPrefs);
  return (
    <Screen footer={<Button label="Continue" onPress={() => router.push('/microphone')} />}>
      <TopBar />
      <Progress step={4} />
      <Text variant="eyebrow" color="inkMuted" style={{ marginTop: space[5] }}>
        About you
      </Text>
      <Text variant="largeTitle" accessibilityRole="header">
        How long have you been playing?
      </Text>
      <Text variant="callout" color="inkMuted" style={{ marginTop: space[2] }}>
        So the first songs feel just right — not too easy, not too hard.
      </Text>
      <View style={{ gap: space[3], marginTop: space[5] }} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const on = o.level === level;
          return (
            <Pressable
              key={o.level}
              onPress={() => setPrefs({ level: o.level })}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={o.label}>
              <Glass
                padding={space[4]}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: space[3] },
                  on && { borderColor: colors.primary, borderWidth: 2 },
                ]}>
                <View style={{ flex: 1, gap: space[1] }}>
                  <Text variant="headline">{o.label}</Text>
                  <Difficulty level={o.level} />
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.pill,
                    borderWidth: 2,
                    borderColor: on ? colors.primary : colors.lineStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} /> : null}
                </View>
              </Glass>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
