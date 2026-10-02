import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Background } from '@/ui/Background';
import { SHEET_DETENTS } from '@/ui/Sheet';

export default function TakeLayout() {
  // The take flow is a full-screen modal: on iOS it sits in its own container, so the root gradient doesn't
  // show through its transparent screens (they'd sit on black). It brings its own, following the scheme.
  return (
    <View style={styles.fill}>
      <Background />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
        <Stack.Screen name="name-idea" options={{ presentation: 'formSheet', sheetAllowedDetents: [SHEET_DETENTS.nameIdea], sheetGrabberVisible: true }} />
        <Stack.Screen name="recording" options={{ gestureEnabled: false }} />
        <Stack.Screen name="transcribing" options={{ gestureEnabled: false }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
