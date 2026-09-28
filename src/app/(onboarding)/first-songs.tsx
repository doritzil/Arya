import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useLibrary } from '@/data/store';
import { levelName } from '@/ui/Chips';
import { RecommendationCard } from '@/features/discover/RecommendationCard';
import { space } from '@/theme';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function FirstSongs() {
  const prefs = useLibrary((s) => s.prefs);
  const feed = useLibrary((s) => s.feed);
  const refreshFeed = useLibrary((s) => s.refreshFeed);
  const setPrefs = useLibrary((s) => s.setPrefs);
  useEffect(() => refreshFeed(), [refreshFeed]);

  const levels = feed.map((s) => s.difficulty);
  const lo = levels.length ? Math.min(...levels) : prefs.level;
  const hi = levels.length ? Math.max(...levels) : prefs.level;
  const genres = prefs.genres.slice(0, 2).join(', ') + (prefs.genres.length > 2 ? ` and ${prefs.genres[2]}` : '');

  return (
    <Screen
      footer={
        <Button
          label="Start exploring"
          onPress={() => {
            setPrefs({ onboardingDone: true });
            router.replace('/discover');
          }}
        />
      }>
      <Text variant="eyebrow" color="inkMuted" style={{ marginTop: space[5] }}>
        {"You're all set"}
      </Text>
      <Text variant="largeTitle" accessibilityRole="header">
        {feed.length} songs picked for you
      </Text>
      <Text variant="callout" color="inkMuted" style={{ marginTop: space[1] }}>
        From {genres} · {levelName(lo as 1)}
        {hi !== lo ? ` to ${levelName(hi as 1)}` : ''}
      </Text>
      <View style={{ gap: space[3], marginTop: space[5] }}>
        {feed.slice(0, 2).map((s) => (
          <RecommendationCard key={s.catalogId} song={s} />
        ))}
      </View>
      <Text variant="footnote" color="inkMuted" align="center" style={{ marginTop: space[4] }}>
        Tap play to hear a song. Want to learn adds it to your list.
      </Text>
    </Screen>
  );
}
