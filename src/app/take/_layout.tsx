import { Stack } from 'expo-router';

import { SHEET_DETENTS } from '@/ui/Sheet';

export default function TakeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="name-idea" options={{ presentation: 'formSheet', sheetAllowedDetents: [SHEET_DETENTS.nameIdea], sheetGrabberVisible: true }} />
      <Stack.Screen name="recording" options={{ gestureEnabled: false }} />
      <Stack.Screen name="transcribing" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
