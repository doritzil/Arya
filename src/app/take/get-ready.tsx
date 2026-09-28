import * as Audio from '@modules/aria-audio';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { useLibrary } from '@/data/store';
import { beginTake, importTake, takeName } from '@/features/record/session';
import { space, useTheme } from '@/theme';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { IconTile } from '@/ui/IconTile';
import { RecordButton } from '@/ui/RecordButton';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

export default function GetReady() {
  const { colors } = useTheme();
  const { songId, idea } = useLocalSearchParams<{ songId?: string; idea?: string }>();
  const song = useLibrary((s) => (songId ? s.songs.find((x) => x.id === songId) : undefined));
  const takeCount = useLibrary((s) => (songId ? s.projects.filter((p) => p.songId === songId).length : 0));
  const base = song?.title ?? idea ?? 'Idea';
  const [countIn, setCountIn] = useState(true);
  const [bpm, setBpm] = useState(80);
  const [inputs, setInputs] = useState<Audio.AudioInput[]>([]);
  const [busy, setBusy] = useState(false);
  const input = inputs.find((i) => i.selected) ?? inputs[0];

  useEffect(() => {
    Audio.getInputs().then(setInputs).catch(() => {});
  }, []);

  const cycleInput = async () => {
    if (inputs.length < 2 || !input) return;
    const next = inputs[(inputs.indexOf(input) + 1) % inputs.length]!;
    await Audio.setPreferredInput(next.id);
    setInputs((xs) => xs.map((x) => ({ ...x, selected: x.id === next.id })));
  };

  const start = async () => {
    setBusy(true);
    try {
      const permission = await Audio.requestMicPermission();
      if (permission !== 'granted') return;
      const project = await beginTake({ kind: song ? 'song' : 'idea', base, songId: song?.id, countInBpm: countIn ? bpm : undefined });
      router.replace({ pathname: '/take/recording', params: { projectId: project.id, title: base, take: String(takeCount + 1), bpm: countIn ? String(bpm) : '' } });
    } finally {
      setBusy(false);
    }
  };

  const importFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    const project = await importTake({ kind: song ? 'song' : 'idea', base, songId: song?.id, uri: asset.uri });
    router.replace({ pathname: '/take/transcribing', params: { projectId: project.id } });
  };

  return (
    <Screen>
      <TopBar title={song ? `${song.artist.split(' ').at(-1)} · take ${takeCount + 1}` : 'New idea'} />
      <Text variant="eyebrow" color="inkMuted" align="center" style={{ marginTop: space[3] }}>
        Ready when you are
      </Text>
      <Text variant="largeTitle" align="center" accessibilityRole="header">
        {base}
      </Text>
      <Glass padding={space[4]} style={{ flexDirection: 'row', gap: space[3], alignItems: 'center', marginTop: space[5] }}>
        <IconTile icon={song ? 'note' : 'wave'} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="footnote" color="inkMuted">
            Will be saved as
          </Text>
          <Text variant="headline">{takeName(base)}</Text>
        </View>
      </Glass>

      <Glass padding={space[4]} style={{ gap: space[4], marginTop: space[3] }}>
        <Row icon="metronome" title="Count-in" subtitle="4 clicks in your headphones first">
          <Switch
            value={countIn}
            onValueChange={setCountIn}
            trackColor={{ true: colors.accent, false: colors.track }}
          thumbColor={colors.keyWhite}
            accessibilityLabel="Count-in"
          />
        </Row>
        <Row icon="timer" title="Tempo">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], opacity: countIn ? 1 : 0.5 }}>
            <IconButton icon="minus" size="small" label="Slower" disabled={!countIn} onPress={() => setBpm((b) => Math.max(40, b - 5))} />
            <Text variant="headline" style={{ minWidth: 64, textAlign: 'center' }} accessibilityLabel={`${bpm} beats per minute`}>
              {bpm} BPM
            </Text>
            <IconButton icon="plus" size="small" label="Faster" disabled={!countIn} onPress={() => setBpm((b) => Math.min(200, b + 5))} />
          </View>
        </Row>
        <Pressable onPress={cycleInput} accessibilityRole="button" accessibilityLabel={`Microphone: ${input?.name ?? 'iPhone microphone'}`}>
          <Row icon="mic" title="Microphone" subtitle={`${input?.name ?? 'iPhone microphone'}${input?.lowBandwidth ? ' · lower quality over Bluetooth' : ''}`}>
            <Icon name="chevron-right" size={18} />
          </Row>
        </Pressable>
      </Glass>

      <View style={{ alignItems: 'center', gap: space[3], marginTop: space[6] }}>
        <RecordButton recording={false} onPress={start} disabled={busy} />
        <Text variant="footnote" color="inkMuted">
          Put your phone near the piano, then tap
        </Text>
        <Pressable onPress={importFile} accessibilityRole="button" hitSlop={10}>
          <Text variant="footnote" color="accent" weight={600} style={{ textDecorationLine: 'underline' }}>
            Import an audio file instead
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Row({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: 'metronome' | 'timer' | 'mic';
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Icon name={icon} size={22} color="inkMuted" />
      <View style={{ flex: 1 }}>
        <Text variant="headline">{title}</Text>
        {subtitle ? (
          <Text variant="footnote" color="inkMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
