import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { takesFor, useLibrary } from '@/data/store';
import { space } from '@/theme';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { IconTile } from '@/ui/IconTile';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function NewRecording() {
  const allSongs = useLibrary((s) => s.songs);
  const songs = allSongs.filter((x) => x.status === 'learning');
  const projects = useLibrary((s) => s.projects);
  return (
    <Screen>
      <TopBar title="New recording" />
      <Text variant="largeTitle" accessibilityRole="header" style={{ marginTop: space[3] }}>
        What are you playing?
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record an idea. Something you made up — you'll give it a name."
        onPress={() => router.push('/take/name-idea')}
        style={{ marginTop: space[5] }}>
        <Glass padding={space[4]} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <IconTile icon="wave" />
          <View style={{ flex: 1 }}>
            <Text variant="headline">Record an idea</Text>
            <Text variant="footnote" color="inkMuted">
              Something you made up — you&apos;ll give it a name
            </Text>
          </View>
          <Icon name="chevron-right" size={18} />
        </Glass>
      </Pressable>
      <Text variant="eyebrow" color="inkMuted" style={{ marginTop: space[5], marginBottom: space[2] }}>
        Songs you&apos;re learning
      </Text>
      <Glass padding={space[2]}>
        {songs.map((s, i) => {
          const takes = takesFor(projects, s.id).length;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Record ${s.title}`}
              onPress={() => router.push({ pathname: '/take/get-ready', params: { songId: s.id } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderTopWidth: i ? 1 : 0, borderColor: 'rgba(0,0,0,0.06)' }}>
              <View style={{ flex: 1 }}>
                <Text variant="headline" numberOfLines={1}>
                  {s.title}
                </Text>
                <Text variant="footnote" color="inkMuted">
                  {s.artist} · {takes === 0 ? 'No takes yet' : takes === 1 ? '1 take' : `${takes} takes`}
                </Text>
              </View>
              <RecordDot />
            </Pressable>
          );
        })}
        {songs.length === 0 ? (
          <Text variant="callout" color="inkMuted" style={{ padding: space[3] }}>
            Songs you add to Learning show up here.
          </Text>
        ) : null}
      </Glass>
    </Screen>
  );
}

function RecordDot() {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="mic" size={20} color="record" />
    </View>
  );
}
