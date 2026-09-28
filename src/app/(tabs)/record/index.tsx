import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useLibrary } from '@/data/store';
import { RecordingCard } from '@/features/record/RecordingCard';
import { fontFamily, radius, space, typeScale, useTheme } from '@/theme';
import { GenreChip } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { Screen, TitleBlock } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const FILTERS = ['All', 'Songs', 'Ideas'] as const;

export default function Recordings() {
  const { colors, shadows } = useTheme();
  const projects = useLibrary((s) => s.projects);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return projects
      .filter((p) => filter === 'All' || (filter === 'Songs' ? p.kind === 'song' : p.kind === 'idea'))
      .filter((p) => !n || p.name.toLowerCase().includes(n))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [projects, q, filter]);

  return (
    <Screen tabBar>
      <TitleBlock
        eyebrow="Everything you've played"
        title="Recordings"
        right={
          <Pressable
            onPress={() => router.push('/take/new')}
            accessibilityRole="button"
            accessibilityLabel="New recording"
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              ...shadows.disc,
            }}>
            <Icon name="plus" size={22} color="onPrimary" />
          </Pressable>
        }
      />
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
          placeholder="Search your recordings"
          placeholderTextColor={colors.inkMuted}
          accessibilityLabel="Search your recordings"
          style={{ flex: 1, color: colors.ink, fontFamily: fontFamily[400], fontSize: typeScale.callout.fontSize }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[3], marginBottom: space[3] }}>
        {FILTERS.map((f) => (
          <GenreChip key={f} label={f} compact selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      <View style={{ gap: space[3] }}>
        {list.map((p) => (
          <RecordingCard key={p.id} project={p} />
        ))}
        {list.length === 0 ? (
          <Glass padding={space[5]} style={{ gap: space[2] }}>
            {q.trim() ? (
              <Text variant="headline">No recordings match “{q.trim()}”</Text>
            ) : (
              <>
                <Text variant="headline">No recordings yet</Text>
                <Text variant="callout" color="inkMuted">
                  Tap + to record a song you&apos;re learning, or an idea you just made up.
                </Text>
              </>
            )}
          </Glass>
        ) : null}
      </View>
    </Screen>
  );
}
