import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme, type ColorName } from '@/theme';

import { ICON_PATHS } from './icons.generated';

type Weight = 'duotone' | 'fill' | 'bold';

export type IconName = keyof typeof ICON_PATHS;

// Default weights from 05-icons/ICONS.md: fill for solid marks, bold for simple glyphs, duotone otherwise.
const FILL = new Set<IconName>(['play', 'pause', 'next', 'record', 'stop']);
const BOLD = new Set<IconName>([
  'check', 'close', 'plus', 'minus', 'chevron-left', 'chevron-right', 'up', 'down', 'more', 'undo', 'redo', 'sort',
]);
const defaultWeight = (n: IconName): Weight => (FILL.has(n) ? 'fill' : BOLD.has(n) ? 'bold' : 'duotone');

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorName;
  weight?: Weight;
  /** Peach tint layer at 55% — icon tiles, active tabs, player side controls, pressed buttons. */
  warm?: boolean;
  /** Set only when the icon stands alone; otherwise the parent control carries the label. */
  label?: string;
}

/** Phosphor icon in the house style: duotone outline with a 20% tint layer. Never emoji, never SF Symbols. */
export function Icon({ name, size = 24, color = 'ink', weight, warm, label }: IconProps) {
  const { colors } = useTheme();
  const paths = ICON_PATHS[name][weight ?? defaultWeight(name)];
  const stroke = colors[color];
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 256 256">
        {paths.map(([d, tint], i) => (
          <Path
            key={i}
            d={d}
            fill={tint && warm ? colors.peach : stroke}
            opacity={tint ? (warm ? 0.55 : 0.2) : 1}
          />
        ))}
      </Svg>
    </View>
  );
}
