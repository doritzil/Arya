import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { useLibrary } from '@/data/store';
import { GENRES, type PickableGenre } from '@/data/types';
import { pickedLabel } from '@/features/onboarding/pickedLabel';
import { Progress } from '@/features/onboarding/Progress';
import { connectAppleMusic } from '@/services/listening';
import { space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { GenreChip } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { IconTile } from '@/ui/IconTile';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function Genres() {
  const { colors } = useTheme();
  const prefs = useLibrary((s) => s.prefs);
  const setPrefs = useLibrary((s) => s.setPrefs);
  const [picked, setPicked] = useState<PickableGenre[]>(prefs.genres);
  const setGenreWeights = useLibrary((s) => s.setGenreWeights);
  const [amNote, setAmNote] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  // FR-27: turning this on asks iOS for Apple Music access; only genre weights are used, on the phone.
  const onAppleMusic = async (on: boolean) => {
    setAmNote(null);
    if (!on) {
      setPrefs({ appleMusicHistoryEnabled: false });
      setGenreWeights({});
      return;
    }
    setConnecting(true);
    const r = await connectAppleMusic();
    setConnecting(false);
    if (r.ok) {
      setPrefs({ appleMusicHistoryEnabled: true });
      setGenreWeights(r.weights);
      setAmNote('Connected — your picks will lean toward what you listen to.');
    } else {
      setPrefs({ appleMusicHistoryEnabled: false });
      setAmNote(
        r.reason === 'unavailable'
          ? "Apple Music can't connect in this preview build. It works in the full Aria app."
          : 'Apple Music access is off. You can turn it on in Settings › Privacy › Media & Apple Music.',
      );
    }
  };
  const toggle = (g: PickableGenre) =>
    setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));

  return (
    <Screen
      footer={
        <View style={{ gap: space[2] }}>
          <Text variant="footnote" color="inkMuted" align="center" accessibilityLiveRegion="polite">
            {pickedLabel(picked.length)}
          </Text>
          <Button
            label="Continue"
            disabled={picked.length < 3}
            onPress={() => {
              setPrefs({ genres: picked });
              router.push('/level');
            }}
          />
        </View>
      }>
      <TopBar />
      <Progress step={3} />
      <Text variant="eyebrow" color="inkMuted" style={{ marginTop: space[5] }}>
        Made around you
      </Text>
      <Text variant="largeTitle" accessibilityRole="header">
        What do you love to listen to?
      </Text>
      <Text variant="callout" color="inkMuted" style={{ marginTop: space[2] }}>
        Pick at least 3. You can change these any time.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[5] }}>
        {GENRES.map((g) => (
          <GenreChip key={g} label={g} selected={picked.includes(g)} onPress={() => toggle(g)} />
        ))}
      </View>
      <Glass padding={space[4]} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[5] }}>
        <IconTile icon="note" />
        <View style={{ flex: 1 }}>
          <Text variant="headline">Use my Apple Music</Text>
          <Text variant="footnote" color="inkMuted">
            Better picks from what you already play. Optional.
          </Text>
        </View>
        <Switch
          value={prefs.appleMusicHistoryEnabled}
          disabled={connecting}
          onValueChange={onAppleMusic}
          trackColor={{ true: colors.accent, false: colors.track }}
          thumbColor={colors.keyWhite}
          accessibilityLabel="Use my Apple Music listening"
        />
      </Glass>
      {amNote ? (
        <Text variant="footnote" color="inkMuted" style={{ marginTop: space[2] }} accessibilityLiveRegion="polite">
          {amNote}
        </Text>
      ) : null}
    </Screen>
  );
}
