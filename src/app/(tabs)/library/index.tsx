import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useLibrary } from '@/data/store';
import { LearningCard } from '@/features/learning/LearningCard';
import { RecordingCard } from '@/features/record/RecordingCard';
import { fontFamily, radius, space, typeScale, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { GenreChip } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { Screen, TitleBlock } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const SORTS = ['Date', 'Title', 'Genre'] as const;
const FILTERS = ['All', 'Songs', 'Ideas'] as const;

/**
 * Library (FR-37): learned songs and ideas, searchable, sortable by title, date or genre.
 * Not designed yet (handoff §6) — built from the existing patterns: Recordings' search + filter chips.
 */
export default function Library() {
  const { colors } = useTheme();
  const songs = useLibrary((s) => s.songs);
  const projects = useLibrary((s) => s.projects);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Date');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const items = useMemo(() => {
    const n = q.trim().toLowerCase();
    const learned = songs
      .filter((s) => s.status === 'learned')
      .map((s) => ({ kind: 'song' as const, key: s.id, title: s.title, genre: s.genre, date: s.learnedAt ?? s.addedAt, song: s }));
    const ideas = projects
      .filter((p) => p.kind === 'idea')
      .map((p) => ({ kind: 'idea' as const, key: p.id, title: p.name, genre: 'Idea', date: p.createdAt, project: p }));
    return [...(filter !== 'Ideas' ? learned : []), ...(filter !== 'Songs' ? ideas : [])]
      .filter((i) => !n || i.title.toLowerCase().includes(n) || i.genre.toLowerCase().includes(n))
      .sort((a, b) => (sort === 'Title' ? a.title.localeCompare(b.title) : sort === 'Genre' ? a.genre.localeCompare(b.genre) : b.date - a.date));
  }, [songs, projects, q, sort, filter]);

  return (
    <Screen tabBar>
      <TitleBlock eyebrow="Everything you've learned" title="Library" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          height: 44,
          paddingHorizontal: space[4],
          borderRadius: radius.pill,
          backgroundColor: colors.glassStrong,
          borderWidth: 1,
          borderColor: colors.glassEdge,
        }}>
        <Icon name="search" size={18} color="inkMuted" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search songs and ideas"
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Search your library"
          style={{ flex: 1, color: colors.ink, fontFamily: fontFamily[400], fontSize: typeScale.callout.fontSize }}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginVertical: space[3] }}>
        {FILTERS.map((f) => (
          <GenreChip key={f} label={f} compact selected={filter === f} onPress={() => setFilter(f)} />
        ))}
        <View style={{ flex: 1 }} />
        <Button
          size="small"
          variant="secondary"
          icon="sort"
          label={sort}
          accessibilityLabel={`Sort by ${sort}. Tap to change`}
          onPress={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]!)}
        />
      </View>
      <View style={{ gap: space[3] }}>
        {items.map((i) => (i.kind === 'song' ? <LearningCard key={i.key} song={i.song} /> : <RecordingCard key={i.key} project={i.project} />))}
        {items.length === 0 ? (
          <Glass padding={space[5]} style={{ gap: space[2] }}>
            <Text variant="headline">{q.trim() ? `Nothing matches “${q.trim()}”` : 'Your library is waiting'}</Text>
            {!q.trim() ? (
              <Text variant="callout" color="inkMuted">
                When you mark a song as learned it moves here with every take. Ideas you record live here too.
              </Text>
            ) : null}
          </Glass>
        ) : null}
      </View>
    </Screen>
  );
}
