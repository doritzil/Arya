import { router } from 'expo-router';
import { View } from 'react-native';

import { takesFor, useLibrary } from '@/data/store';
import type { Prefs } from '@/data/types';
import { LearningCard } from '@/features/learning/LearningCard';
import { space } from '@/theme';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { IconButton } from '@/ui/IconButton';
import { Screen, TitleBlock } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const SORTS: { key: Prefs['learningSort']; label: string }[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'title', label: 'Title' },
  { key: 'takes', label: 'Most takes' },
];

export default function Learning() {
  const songs = useLibrary((s) => s.songs);
  const projects = useLibrary((s) => s.projects);
  const sort = useLibrary((s) => s.prefs.learningSort);
  const setPrefs = useLibrary((s) => s.setPrefs);
  const idx = SORTS.findIndex((s) => s.key === sort);

  const list = songs
    .filter((s) => s.status === 'learning')
    .sort((a, b) =>
      sort === 'title'
        ? a.title.localeCompare(b.title)
        : sort === 'takes'
          ? takesFor(projects, b.id).length - takesFor(projects, a.id).length
          : b.addedAt - a.addedAt,
    );

  return (
    <Screen tabBar>
      <TitleBlock
        eyebrow="Your practice"
        title="Learning"
        right={<IconButton icon="plus" label="Add a song" onPress={() => router.push('/discover/search')} />}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[3] }}>
        <Text variant="callout" color="inkMuted">
          {list.length === 1 ? '1 song' : `${list.length} songs`}
        </Text>
        <Button
          size="small"
          variant="secondary"
          icon="sort"
          label={SORTS[idx]?.label ?? 'Recently added'}
          accessibilityLabel={`Sort: ${SORTS[idx]?.label}. Tap to change`}
          onPress={() => setPrefs({ learningSort: SORTS[(idx + 1) % SORTS.length]!.key })}
        />
      </View>
      <View style={{ gap: space[3] }}>
        {list.map((s) => (
          <LearningCard key={s.id} song={s} />
        ))}
        {list.length === 0 ? (
          <Glass padding={space[5]} style={{ gap: space[3] }}>
            <Text variant="headline">Nothing on your list yet</Text>
            <Text variant="callout" color="inkMuted">
              Tap Want to learn on a song you like and it will wait for you here.
            </Text>
            <Button label="Find songs" variant="secondary" onPress={() => router.navigate('/discover')} />
          </Glass>
        ) : null}
      </View>
    </Screen>
  );
}
