import { Stack } from 'expo-router';

export default function TakeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="name-idea" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true }} />
      <Stack.Screen name="recording" options={{ gestureEnabled: false }} />
      <Stack.Screen name="transcribing" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
