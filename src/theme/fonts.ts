import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  useFonts,
} from '@expo-google-fonts/outfit';

/** Outfit (OFL) — the three weights the design system uses. */
export const fontFamily = {
  400: 'Outfit_400Regular',
  500: 'Outfit_500Medium',
  600: 'Outfit_600SemiBold',
} as const;

export type FontWeight = keyof typeof fontFamily;

export function useAriaFonts() {
  return useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });
}
