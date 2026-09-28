import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { fontFamily, typeScale, useTheme, type ColorName, type TypeVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: ColorName;
  align?: TextStyle['textAlign'];
  weight?: 400 | 500 | 600;
}

const UPPERCASE: Partial<Record<TypeVariant, true>> = { eyebrow: true };

/** Outfit text in one of the design system's type styles. Scales with Dynamic Type. */
export function Text({ variant = 'body', color = 'ink', align, weight, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const t = typeScale[variant];
  const w = weight ?? (t.fontWeight as 400 | 500 | 600);
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fontFamily[w],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color: colors[color],
          textAlign: align,
          textTransform: UPPERCASE[variant] ? 'uppercase' : undefined,
        },
        style,
      ]}
    />
  );
}
