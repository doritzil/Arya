import { Tabs } from 'expo-router';

import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={({ navigation }) => ({
        headerShown: false,
        // Scenes are transparent (one gradient behind everything). Where inactive tabs aren't detached
        // (web), hide them so they don't show through the focused one.
        sceneStyle: { backgroundColor: 'transparent', display: navigation.isFocused() ? 'flex' : 'none' },
      })}>
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="learning" />
      <Tabs.Screen name="record" />
      <Tabs.Screen name="library" />
    </Tabs>
  );
}
