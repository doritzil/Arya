import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useTheme } from '@/theme';

import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  discover: { label: 'Discover', icon: 'discover' },
  learning: { label: 'Learning', icon: 'learning' },
  record: { label: 'Record', icon: 'mic' },
  library: { label: 'Library', icon: 'library' },
};

/** Frosted glass tab bar matching the loop: Discover → Learning → Record → Library. */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Glass
      variant="blur"
      strong
      radius={0}
      shadow={false}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space[5]), borderColor: colors.glassEdge }]}>
      <View style={styles.row} accessibilityRole="tabbar">
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
                else if (focused) navigation.navigate(route.name, { screen: 'index' });
              }}
              style={styles.tab}>
              <Icon
                name={tab.icon}
                size={26}
                color={focused ? 'accent' : 'inkMuted'}
                weight={focused ? 'fill' : 'duotone'}
                warm={focused}
              />
              <Text
                variant="caption"
                color={focused ? 'ink' : 'inkMuted'}
                maxFontSizeMultiplier={1.3}
                style={{ fontSize: 11, lineHeight: 13, letterSpacing: 0 }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: space[2],
  },
  row: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' },
});
