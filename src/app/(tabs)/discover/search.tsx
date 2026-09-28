import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { SEED_CATALOG } from '@/data/seedCatalog';
import { useLibrary } from '@/data/store';
import { RecommendationCard } from '@/features/discover/RecommendationCard';
import { LearningCard } from '@/features/learning/LearningCard';
import { radius, space, typeScale, fontFamily, useTheme } from '@/theme';
import { GenreChip } from '@/ui/Chips';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { router } from 'expo-router';

const FILTERS = [
  { label: 'All levels', match: () => true },
  { label: 'Easy', match: (l: number) => l <= 2 },
  { label: 'Intermediate', match: (l: number) => l === 3 },
  { label: 'Advanced', match: (l: number) => l >= 4 },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Search() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState(0);
  const songs = useLibrary((s) => s.songs);
  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    const f = FILTERS[filter] ?? FILTERS[0]!;
    return SEED_CATALOG.filter((s) => f.match(s.difficulty) && (norm(s.title).includes(n) || norm(s.artist).includes(n)));
  }, [q, filter]);

  return (
    <Screen tabBar>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            height: 48,
            paddingHorizontal: space[4],
            borderRadius: radius.pill,
            backgroundColor: colors.glassStrong,
            borderWidth: 1,
            borderColor: colors.glassEdge,
          }}>
          <Icon name="search" size={20} color="inkMuted" />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="Songs, artists, composers"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Search songs, artists or composers"
            returnKeyType="search"
            style={{ flex: 1, color: colors.ink, fontFamily: fontFamily[400], fontSize: typeScale.body.fontSize }}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] }}>
        {FILTERS.map((f, i) => (
          <GenreChip key={f.label} label={f.label} compact selected={i === filter} onPress={() => setFilter(i)} />
        ))}
      </View>
      {q.trim() ? (
        <Text variant="footnote" color="inkMuted" style={{ marginTop: space[3] }} accessibilityLiveRegion="polite">
          {results.length === 1 ? '1 song' : `${results.length} songs`} for “{q.trim()}”
        </Text>
      ) : null}
      <View style={{ gap: space[3], marginTop: space[3] }}>
        {results.map((c) => {
          const mine = songs.find((s) => s.catalogId === c.catalogId);
          return mine ? <LearningCard key={c.catalogId} song={mine} /> : <RecommendationCard key={c.catalogId} song={c} />;
        })}
      </View>
    </Screen>
  );
}
