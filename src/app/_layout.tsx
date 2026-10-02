import * as Notifications from 'expo-notifications';
import { Stack, ThemeProvider as NavThemeProvider, DefaultTheme, DarkTheme, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useLibrary } from '@/data/store';
import { recoverAfterLaunch } from '@/features/record/session';
import { useStopOnNavigate } from '@/playback/useStopOnNavigate';
import { listeningWeights } from '@/services/listening';
import { ThemeProvider, useAriaFonts, useTheme } from '@/theme';
import { Background } from '@/ui/Background';
import { SHEET_DETENTS } from '@/ui/Sheet';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useAriaFonts();
  const ready = useLibrary((s) => s.ready);
  const hydrate = useLibrary((s) => s.hydrate);

  useEffect(() => {
    hydrate()
      .then(() => {
        const { prefs, setGenreWeights } = useLibrary.getState();
        if (prefs.appleMusicHistoryEnabled) listeningWeights().then(setGenreWeights).catch(() => {});
      })
      .then(recoverAfterLaunch)
      .catch((e) => console.warn('[library] hydrate failed', e));
  }, [hydrate]);

  // Tapping "Your notes are ready" opens that take.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as never);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, ready]);

  if (!fontsLoaded || !ready) return null;

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { scheme } = useTheme();
  useStopOnNavigate();
  const onboarded = useLibrary((s) => s.prefs.onboardingDone);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  // Screens are transparent so the one gradient behind the navigator shows through (§6.3).
  const navTheme = { ...base, colors: { ...base.colors, background: 'transparent', card: 'transparent' } };
  return (
    <NavThemeProvider value={navTheme}>
      <View style={styles.fill}>
        <Background />
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="(onboarding)" />
          </Stack.Protected>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="keyboard/[source]" options={{ animation: 'fade', orientation: 'landscape' }} />
            <Stack.Screen name="take" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="edit/[projectId]" />
            <Stack.Screen
              name="sheets/edit-genres"
              options={{ presentation: 'formSheet', sheetAllowedDetents: [SHEET_DETENTS.editGenres], sheetGrabberVisible: true }}
            />
            <Stack.Screen
              name="sheets/how-its-written"
              options={{ presentation: 'formSheet', sheetAllowedDetents: [SHEET_DETENTS.howItsWritten], sheetGrabberVisible: true }}
            />
            <Stack.Screen
              name="sheets/share"
              options={{ presentation: 'formSheet', sheetAllowedDetents: [SHEET_DETENTS.share], sheetGrabberVisible: true }}
            />
          </Stack.Protected>
        </Stack>
      </View>
    </NavThemeProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
