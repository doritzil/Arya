import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { takesFor, useLibrary } from '@/data/store';
import { RecommendationCard } from '@/features/discover/RecommendationCard';
import { space } from '@/theme';
import { GenreChip } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Screen, TitleBlock } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function Discover() {
  const genres = useLibrary((s) => s.prefs.genres);
  const feed = useLibrary((s) => s.feed);
  const songs = useLibrary((s) => s.songs);
  const projects = useLibrary((s) => s.projects);

  // "Pick up where you left off": the Learning song practised most recently (songs with takes first).
  const resume = songs
    .filter((s) => s.status === 'learning')
    .map((s) => {
      const takes = takesFor(projects, s.id);
      return { s, takes, last: takes[0]?.createdAt ?? 0, added: s.addedAt };
    })
    .sort((a, b) => b.last - a.last || b.added - a.added)[0];

  return (
    <Screen tabBar>
      <TitleBlock
        eyebrow="Made around you"
        title="Picked for you"
        right={<IconButton icon="search" label="Search songs" onPress={() => router.push('/discover/search')} />}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {genres.map((g) => (
          <GenreChip key={g} label={g} selected compact onPress={() => router.push('/sheets/edit-genres')} />
        ))}
        <IconButton icon="sliders" size="small" label="Edit genres" onPress={() => router.push('/sheets/edit-genres')} />
      </View>

      {resume ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pick up where you left off: ${resume.s.title}`}
          onPress={() => router.push(`/learning/${resume.s.id}`)}
          style={{ marginTop: space[4] }}>
          <Glass padding={space[4]} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Icon name="learning" size={26} />
            <View style={{ flex: 1 }}>
              <Text variant="footnote" color="inkMuted">
                Pick up where you left off
              </Text>
              <Text variant="headline" numberOfLines={1}>
                {resume.s.title} · {resume.takes.length === 1 ? '1 take' : `${resume.takes.length} takes`}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} />
          </Glass>
        </Pressable>
      ) : null}

      <View style={{ gap: space[3], marginTop: space[4] }}>
        {feed.map((s) => (
          <RecommendationCard key={s.catalogId} song={s} />
        ))}
        {feed.length === 0 ? (
          <Glass padding={space[5]}>
            <Text variant="headline">{"You've seen everything for now"}</Text>
            <Text variant="callout" color="inkMuted">
              Add a genre or two and new picks will show up here.
            </Text>
          </Glass>
        ) : null}
      </View>
    </Screen>
  );
}
