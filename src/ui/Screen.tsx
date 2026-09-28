import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

/** Height the glass tab bar covers, so scroll content can clear it. */
export const TAB_BAR_CLEARANCE = 96;

export function Screen({
  children,
  scroll = true,
  tabBar = false,
  footer,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Pad the bottom for the floating tab bar. */
  tabBar?: boolean;
  /** Pinned bottom area (primary action). */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const bottom = (tabBar ? TAB_BAR_CLEARANCE : 0) + (footer ? 0 : insets.bottom + space[4]);
  const content = [{ paddingTop: insets.top + space[3], paddingHorizontal: space[4], paddingBottom: bottom }, style];
  return (
    <View style={styles.fill}>
      {scroll ? (
        <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, content]}>{children}</View>
      )}
      {footer ? (
        <View style={{ paddingHorizontal: space[4], paddingBottom: insets.bottom + space[3], paddingTop: space[2] }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** Top row: optional back button, centred small title, optional right control. */
export function TopBar({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <View style={styles.topBar}>
      <IconButton icon="chevron-left" label="Back" onPress={onBack ?? (() => router.back())} />
      <Text variant="callout" weight={500} style={styles.topTitle} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

/** Eyebrow + large title (+ optional right control), as on every tab home. */
export function TitleBlock({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text variant="eyebrow" color="inkMuted">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="largeTitle" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] },
  topTitle: { flex: 1, textAlign: 'center' },
  side: { width: 48, alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3], marginTop: space[5], marginBottom: space[3] },
});
