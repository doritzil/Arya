import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibrary } from '@/data/store';
import { fitRange, lastStartedIndex } from '@/features/keyboard/geometry';
import { FallingKeys } from '@/features/keyboard/FallingKeys';
import { SpeedSlider } from '@/features/keyboard/SpeedSlider';
import { useProjectScore } from '@/features/notes/useProjectScore';
import { formatShortDate } from '@/lib/format';
import { usePlayback } from '@/playback/coordinator';
import { useVisualClock } from '@/playback/useVisualClock';
import { radius, space, ThemeProvider, useTheme } from '@/theme';
import { Background } from '@/ui/Background';
import { Icon } from '@/ui/Icon';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

/** Lead-in so the first notes fall in from the top instead of appearing on the keys. */
const LEAD_SEC = 2;

export default function KeyboardModeRoute() {
  return (
    <ThemeProvider force="dark">
      <KeyboardMode />
    </ThemeProvider>
  );
}

function KeyboardMode() {
  useKeepAwake();
  const { source = '' } = useLocalSearchParams<{ source: string }>();
  const [kind, id = ''] = source.split(/:(.*)/s) as ['score' | 'project', string];
  const project = useLibrary((s) => (kind === 'project' ? s.projects.find((p) => p.id === id) : undefined));
  const song = useLibrary((s) => s.songs.find((x) => x.id === (kind === 'score' ? id : project?.songId)));
  const score = useProjectScore(kind === 'score' ? `score:${id}` : id);
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const key = `kb:${source}`;
  const fall = useMemo(
    () => (score?.fallNotes ?? []).map((n) => ({ ...n, startSec: n.startSec + LEAD_SEC, endSec: n.endSec + LEAD_SEC })),
    [score],
  );
  const synth = useMemo(
    () => (score?.synthNotes ?? []).map((n) => ({ ...n, startSec: n.startSec + LEAD_SEC, endSec: n.endSec + LEAD_SEC })),
    [score],
  );
  const range = useMemo(() => fitRange(fall), [fall]);
  const now = useVisualClock(key);
  const pb = usePlayback();
  const mine = pb.source?.key === key;
  const playing = mine && (pb.status === 'playing' || pb.status === 'loading');
  const title = song?.title ?? project?.name.split(' — ')[0] ?? 'Your notes';
  const sourceLabel = kind === 'score' ? 'Score · piano' : `My notes · ${project ? formatShortDate(project.createdAt) : ''}`;
  const tempo = score?.build.model.settings.tempoBpm ?? 80;
  const spanSec = (4 * 60) / tempo; // one 4-beat bar visible above the keys
  const barCount = score?.build.model.barCount ?? 0;
  const bar = useMemo(() => {
    if (!mine) return 1;
    const last = fall[lastStartedIndex(fall, pb.positionSec)];
    return Math.max(1, (last?.bar ?? 0) + 1);
  }, [pb.positionSec, mine, fall]);

  useEffect(() => () => usePlayback.getState().stop(), []);

  const start = () =>
    mine ? pb.toggle({ kind: 'synth', key, title, notes: synth }) : pb.play({ kind: 'synth', key, title, notes: synth });

  const railW = 76;
  const fieldW = width - insets.left - insets.right - railW * 2;
  const fieldH = height - insets.top - insets.bottom - 72;

  return (
    <View style={{ flex: 1, flexDirection: 'row', paddingLeft: insets.left, paddingRight: insets.right }}>
      <Background />
      <StatusBar hidden />
      {/* Left rail */}
      <View style={{ width: railW, alignItems: 'center', paddingTop: insets.top + space[3], gap: space[3] }}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', gap: space[3] }}>
          <Pressable
            onPress={start}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={playing ? 'pause' : 'play'} size={24} color="onPrimary" />
          </Pressable>
          <IconButton icon="back" label="Back 5 seconds" onPress={() => pb.skipBack(5)} />
          <IconButton icon="repeat" label={pb.loop ? 'Loop is on' : 'Loop is off'} pressed={pb.loop} onPress={() => pb.setLoop(!pb.loop)} />
        </View>
      </View>

      {/* Centre: header, keys, progress */}
      <View style={{ flex: 1, paddingTop: insets.top + space[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], height: 48 }}>
          <Legend color={colors.accent} label="Left hand" />
          <Legend color={colors.peach} label="Right hand" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[2] }}>
            <Text variant="headline" numberOfLines={1}>
              {title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[1],
                paddingHorizontal: space[3],
                height: 28,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.glassEdge,
                backgroundColor: colors.glass,
              }}>
              <Icon name={kind === 'score' ? 'note' : 'mic'} size={14} color="inkMuted" />
              <Text variant="footnote" color="inkMuted">
                {sourceLabel}
              </Text>
            </View>
          </View>
          <Text variant="footnote" color="inkMuted" accessibilityLiveRegion="polite">
            {barCount ? `Bar ${Math.min(bar, barCount)} of ${barCount}` : ''}
          </Text>
        </View>
        {score ? (
          <FallingKeys
            notes={fall}
            now={now}
            low={range.low}
            high={range.high}
            width={Math.max(200, fieldW)}
            height={Math.max(160, fieldH)}
            spanSec={spanSec}
            reduceMotion={reduceMotion}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="callout" color="inkMuted">
              Getting the notes ready…
            </Text>
          </View>
        )}
        <View style={{ height: 3, marginTop: space[2], borderRadius: radius.pill, backgroundColor: colors.track }}>
          <View
            style={{
              width: `${mine && pb.durationSec ? Math.min(100, (pb.positionSec / pb.durationSec) * 100) : 0}%`,
              height: 3,
              borderRadius: radius.pill,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      </View>

      {/* Right rail: speed 40–120 % */}
      <View style={{ width: railW, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
        <SpeedSlider value={pb.rate} onChange={pb.setRate} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text variant="footnote" color="inkMuted">
        {label}
      </Text>
    </View>
  );
}
