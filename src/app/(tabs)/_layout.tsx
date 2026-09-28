import { Tabs } from 'expo-router';

import { TabBar } from '@/ui/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}>
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="learning" />
      <Tabs.Screen name="record" />
      <Tabs.Screen name="library" />
    </Tabs>
  );
}
