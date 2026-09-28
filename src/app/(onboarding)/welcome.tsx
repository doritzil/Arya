import { router } from 'expo-router';
import { View } from 'react-native';

import { Progress } from '@/features/onboarding/Progress';
import { space } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Waveform } from '@/ui/Waveform';

export default function Welcome() {
  return (
    <Screen
      scroll={false}
      footer={
        <View style={{ gap: space[3] }}>
          <Progress step={1} />
          <Button label="Get started" onPress={() => router.push('/how-it-works')} />
          <Text variant="footnote" color="inkMuted" align="center">
            No account needed · takes a minute
          </Text>
        </View>
      }>
      <Text variant="headline" align="center" style={{ marginTop: space[5] }}>
        Aria
      </Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Waveform seed={7} height={150} bars={48} progress={1} />
      </View>
      <View style={{ gap: space[3], marginBottom: space[5] }}>
        <Text variant="eyebrow" color="inkMuted" align="center">
          Your piano companion
        </Text>
        <Text variant="largeTitle" align="center" accessibilityRole="header" style={{ fontSize: 40, lineHeight: 44 }}>
          Learn the songs you love.
        </Text>
        <Text variant="callout" color="inkMuted" align="center">
          Aria finds songs for you, plays them while you practise, and turns your playing into notes.
        </Text>
      </View>
    </Screen>
  );
}
