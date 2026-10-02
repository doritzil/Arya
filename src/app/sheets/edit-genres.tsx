import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useLibrary } from '@/data/store';
import { GENRES, type PickableGenre } from '@/data/types';
import { pickedLabel } from '@/features/onboarding/pickedLabel';
import { space } from '@/theme';
import { Button } from '@/ui/Button';
import { GenreChip } from '@/ui/Chips';
import { SHEET_DETENTS, Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

export default function EditGenres() {
  const current = useLibrary((s) => s.prefs.genres);
  const setGenres = useLibrary((s) => s.setGenres);
  const [picked, setPicked] = useState<PickableGenre[]>(current);
  const toggle = (g: PickableGenre) => setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  return (
    <Sheet
      detent={SHEET_DETENTS.editGenres}
      title="Your genres"
      subtitle="New picks show up as soon as you save."
      footer={
        <View style={{ gap: space[2] }}>
          <Text variant="footnote" color="inkMuted" align="center">
            {pickedLabel(picked.length)}
          </Text>
          <Button
            label="Save"
            disabled={picked.length < 3}
            onPress={() => {
              setGenres(picked);
              router.back();
            }}
          />
        </View>
      }>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {GENRES.map((g) => (
          <GenreChip key={g} label={g} selected={picked.includes(g)} onPress={() => toggle(g)} />
        ))}
      </View>
    </Sheet>
  );
}
