import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useTheme } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

/** Fraction of the screen each sheet opens to — used by the layouts' `sheetAllowedDetents` and by `Sheet`. */
export const SHEET_DETENTS = {
  editGenres: 0.75,
  howItsWritten: 0.85,
  share: 0.6,
  nameIdea: 0.5,
} as const;

/** Body of a bottom sheet route (presentation: 'formSheet'): title, close, scrolling content, pinned footer. */
export function Sheet({
  title,
  subtitle,
  children,
  footer,
  detent,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** The sheet's detent (a SHEET_DETENTS value). */
  detent: number;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // An explicit height, not flex: 1. On iOS a formSheet's content is laid out with no bottom edge, so a
  // flex: 1 root collapses to zero height and the sheet opens empty.
  return (
    <View style={{ height: Math.round(height * detent), backgroundColor: colors.surfaceRaised }}>
      <ScrollView contentContainerStyle={{ padding: space[5], paddingBottom: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3], marginBottom: space[4] }}>
          <View style={{ flex: 1, gap: space[1] }}>
            <Text variant="title2" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="callout" color="inkMuted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          <IconButton icon="close" size="small" label="Close" onPress={() => router.back()} />
        </View>
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: space[5], paddingBottom: insets.bottom + space[3] }}>{footer}</View>
      ) : null}
    </View>
  );
}
