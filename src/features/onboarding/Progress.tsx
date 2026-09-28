import { View } from 'react-native';

import { useTheme } from '@/theme';

/** Onboarding progress: the current step is a wide pill, the rest dots. */
export function Progress({ step, total = 5 }: { step: number; total?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: i + 1 === step ? 22 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i + 1 <= step ? colors.primary : colors.track,
          }}
        />
      ))}
    </View>
  );
}
