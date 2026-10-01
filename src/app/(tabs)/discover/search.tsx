import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { SEED_CATALOG } from '@/data/seedCatalog';
import { useLibrary } from '@/data/store';
import { RecommendationCard } from '@/features/discover/RecommendationCard';
import { LearningCard } from '@/features/learning/LearningCard';
import type { CatalogSong } from '@/data/types';
import { searchAppleMusic, songKey } from '@/services/appleMusic';
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

const APPLE_DEBOUNCE_MS = 350;

type AppleState = { term: string; status: 'loading' | 'done' | 'error'; items: CatalogSong[] };

/** Apple Music catalog results for `term`, debounced; stale requests are aborted. */
function useAppleMusicSearch(term: string): AppleState | null {
  const [state, setState] = useState<AppleState | null>(null);
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setState({ term, status: 'loading', items: [] });
      searchAppleMusic(term, { signal: ctrl.signal })
        .then((items) => setState({ term, status: 'done', items }))
        .catch(() => {
          if (!ctrl.signal.aborted) setState({ term, status: 'error', items: [] });
        });
    }, APPLE_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);
  return term.length < 2 ? null : state?.term === term ? state : { term, status: 'loading', items: [] };
}

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
    return SEED_CATALOG.filter((s) => f.match(s.difficulty ?? 0) && (norm(s.title).includes(n) || norm(s.artist).includes(n)));
  }, [q, filter]);

  const apple = useAppleMusicSearch(q.trim());
  // Songs already in Aria's catalog show once, in the rated list above.
  const appleItems = useMemo(() => {
    const local = new Set(SEED_CATALOG.map((s) => songKey(s.title, s.artist)));
    return (apple?.items ?? []).filter((s) => !local.has(songKey(s.title, s.artist)));
  }, [apple]);

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
      {results.length > 0 ? (
        <Text variant="footnote" color="inkMuted" style={{ marginTop: space[3] }} accessibilityLiveRegion="polite">
          {results.length === 1 ? '1 rated song' : `${results.length} rated songs`} for “{q.trim()}”
        </Text>
      ) : null}
      <View style={{ gap: space[3], marginTop: space[3] }}>
        {results.map((c) => {
          const mine = songs.find((s) => s.catalogId === c.catalogId);
          return mine ? <LearningCard key={c.catalogId} song={mine} /> : <RecommendationCard key={c.catalogId} song={c} />;
        })}
      </View>
      {apple ? (
        <View style={{ gap: space[3], marginTop: space[5] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Text variant="eyebrow" color="inkMuted" accessibilityRole="header" style={{ flex: 1 }}>
              From Apple Music
            </Text>
            {apple.status === 'loading' ? <ActivityIndicator color={colors.inkMuted} accessibilityLabel="Searching Apple Music" /> : null}
          </View>
          {apple.status === 'error' ? (
            <Text variant="footnote" color="inkMuted">
              Couldn&apos;t reach Apple Music. Check your connection and try again.
            </Text>
          ) : apple.status === 'done' && appleItems.length === 0 ? (
            <Text variant="footnote" color="inkMuted">
              No other songs found on Apple Music.
            </Text>
          ) : apple.status === 'done' && filter !== 0 ? (
            <Text variant="footnote" color="inkMuted">
              These aren&apos;t rated for difficulty yet, so the level filter doesn&apos;t apply to them.
            </Text>
          ) : null}
          {appleItems.map((c) => {
            const mine = songs.find((s) => s.catalogId === c.catalogId);
            return mine ? <LearningCard key={c.catalogId} song={mine} /> : <RecommendationCard key={c.catalogId} song={c} dismissible={false} />;
          })}
        </View>
      ) : null}
    </Screen>
  );
}
