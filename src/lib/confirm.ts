import { Alert, Platform } from 'react-native';

/**
 * A yes/no question with a destructive action. iOS shows a native alert; the web preview (where
 * react-native-web's Alert does nothing) falls back to window.confirm.
 */
export function confirmDestructive(title: string, message: string, actionLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: actionLabel, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

/** "Remove “Hello” from Learning?" — shared by the song page and the Learning list. */
export function confirmRemoveSong(title: string, takeCount: number): Promise<boolean> {
  const takes =
    takeCount === 0
      ? 'You can add it again from Discover.'
      : `Your ${takeCount === 1 ? 'recording stays' : `${takeCount} recordings stay`} in Recordings.`;
  return confirmDestructive(`Remove “${title}”?`, `It comes off your list. ${takes}`, 'Remove');
}
