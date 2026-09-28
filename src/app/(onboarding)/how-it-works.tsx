import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Progress } from '@/features/onboarding/Progress';
import { space } from '@/theme';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { IconTile } from '@/ui/IconTile';
import type { IconName } from '@/ui/Icon';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const ROWS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'discover',
    title: "Find songs you'll love",
    body: 'Tell Aria what you listen to. It picks songs to learn, each with a difficulty level.',
  },
  {
    icon: 'repeat',
    title: 'Learn by listening',
    body: 'Play the original on a loop while you practise, and skip back to replay a tricky bit.',
  },
  {
    icon: 'mic',
    title: 'Play it back, see your notes',
    body: 'Record yourself and Aria writes down what you played — right on your phone.',
  },
];

export default function HowItWorks() {
  return (
    <Screen footer={<Button label="Next" onPress={() => router.push('/genres')} />}>
      <TopBar
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push('/genres')} hitSlop={12}>
            <Text variant="callout" weight={500}>
              Skip
            </Text>
          </Pressable>
        }
      />
      <Progress step={2} />
      <Text variant="eyebrow" color="inkMuted" style={{ marginTop: space[5] }}>
        How Aria works
      </Text>
      <Text variant="largeTitle" accessibilityRole="header">
        One little loop, on repeat.
      </Text>
      <View style={{ gap: space[3], marginTop: space[5] }}>
        {ROWS.map((r) => (
          <Glass key={r.title} padding={space[4]} style={{ flexDirection: 'row', gap: space[3] }}>
            <IconTile icon={r.icon} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline">{r.title}</Text>
              <Text variant="footnote" color="inkMuted">
                {r.body}
              </Text>
            </View>
          </Glass>
        ))}
      </View>
      <Text variant="footnote" color="inkMuted" align="center" style={{ marginTop: space[5] }}>
        When a song is learned, it moves to your Library with every take.
      </Text>
    </Screen>
  );
}
