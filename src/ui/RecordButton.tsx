import { Pressable, View } from 'react-native';

import { radius, useTheme } from '@/theme';

import { Icon } from './Icon';

/**
 * The one big record control (FR-1, FR-3). Idle: mic on a `record` disc with a glass halo.
 * Recording: a stop square — state is shown by shape, not only colour. The only place `record` is used.
 */
export function RecordButton({ recording, onPress, disabled }: { recording: boolean; onPress: () => void; disabled?: boolean }) {
  const { colors, shadows } = useTheme();
  return (
    <View style={{ padding: 12, borderRadius: radius.pill, backgroundColor: colors.glass }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
        style={({ pressed }) => ({
          width: 96,
          height: 96,
          borderRadius: radius.pill,
          backgroundColor: colors.record,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          ...shadows.disc,
        })}>
        {recording ? (
          <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: colors.onRecord }} />
        ) : (
          <Icon name="mic" size={40} color="onRecord" />
        )}
      </Pressable>
    </View>
  );
}
