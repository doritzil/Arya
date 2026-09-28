import { View } from 'react-native';

import { radius, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';

/** Rounded glass-strong tile holding an accent duotone icon with the warm tint (list rows, settings). */
export function IconTile({ icon, dim, size = 48 }: { icon: IconName; dim?: boolean; size?: number }) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: colors.glassStrong,
        borderWidth: 1,
        borderColor: colors.glassEdge,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dim ? 0.7 : 1,
        ...shadows.knob,
      }}>
      <Icon name={icon} size={size * 0.5} color={dim ? 'inkMuted' : 'accent'} warm={!dim} />
    </View>
  );
}
