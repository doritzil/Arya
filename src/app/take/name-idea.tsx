import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { formatTakeStamp } from '@/lib/format';
import { fontFamily, radius, space, typeScale, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export default function NameIdea() {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [now] = useState(() => Date.now());
  const ok = name.trim().length > 0;
  const go = () => ok && router.replace({ pathname: '/take/get-ready', params: { idea: name.trim() } });
  return (
    <Sheet
      title="Name your idea"
      subtitle="So you can find it later. You can rename it any time."
      footer={<Button label="Continue" icon="mic" disabled={!ok} onPress={go} />}>
      <Text variant="footnote" color="inkMuted" style={{ marginBottom: space[1] }}>
        Idea name
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="go"
        onSubmitEditing={go}
        accessibilityLabel="Idea name"
        placeholder="Night drive"
        placeholderTextColor={colors.inkMuted}
        style={{
          height: 52,
          paddingHorizontal: space[4],
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: colors.accent,
          backgroundColor: colors.surfaceRaised,
          color: colors.ink,
          fontFamily: fontFamily[400],
          fontSize: typeScale.body.fontSize,
        }}
      />
      <View style={{ marginTop: space[2] }}>
        <Text variant="footnote" color="inkMuted">
          Saved with today&apos;s date: {formatTakeStamp(now)}
        </Text>
      </View>
    </Sheet>
  );
}
