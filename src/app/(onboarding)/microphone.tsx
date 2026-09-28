import { requestMicPermission } from '@modules/aria-audio';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Progress } from '@/features/onboarding/Progress';
import { radius, space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const PROMISES = [
  "The mic is on only while you're recording.",
  'Your recordings stay on your phone.',
  'Notes are written on your phone too — even offline.',
];

export default function Microphone() {
  const { colors, shadows } = useTheme();
  const next = () => router.push('/first-songs');
  return (
    <Screen
      footer={
        <View style={{ gap: space[2] }}>
          <Button
            label="Allow microphone"
            icon="mic"
            onPress={async () => {
              await requestMicPermission().catch(() => 'denied');
              next();
            }}
          />
          <Button label="Not now" variant="ghost" onPress={next} />
          <Text variant="footnote" color="inkMuted" align="center">
            You can change this any time in Settings.
          </Text>
        </View>
      }>
      <TopBar />
      <Progress step={5} />
      <View style={{ alignItems: 'center', marginTop: space[6] }}>
        <View style={{ padding: 14, borderRadius: radius.pill, backgroundColor: colors.glass }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              ...shadows.disc,
            }}>
            <Icon name="mic" size={36} color="onPrimary" />
          </View>
        </View>
        <Text variant="eyebrow" color="inkMuted" style={{ marginTop: space[5] }}>
          One last thing
        </Text>
        <Text variant="largeTitle" align="center" accessibilityRole="header">
          Aria listens only when you ask.
        </Text>
      </View>
      <Glass padding={space[4]} style={{ gap: space[3], marginTop: space[5] }}>
        {PROMISES.map((p) => (
          <View key={p} style={{ flexDirection: 'row', gap: space[2] }}>
            <Icon name="check" size={18} color="success" />
            <Text variant="callout" style={{ flex: 1 }}>
              {p}
            </Text>
          </View>
        ))}
      </Glass>
    </Screen>
  );
}
