import * as Audio from '@modules/aria-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { discardTake, finishTake } from '@/features/record/session';
import { formatClock } from '@/lib/format';
import { space, ThemeProvider } from '@/theme';
import { Button } from '@/ui/Button';
import { LevelMeter } from '@/ui/LevelMeter';
import { RecordButton } from '@/ui/RecordButton';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Waveform } from '@/ui/Waveform';

const LIVE_BARS = 48;

export default function RecordingRoute() {
  return (
    <ThemeProvider>
      <Recording />
    </ThemeProvider>
  );
}

function Recording() {
  const { title = 'Recording', take = '1', bpm } = useLocalSearchParams<{ title?: string; take?: string; bpm?: string }>();
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [warning, setWarning] = useState<'quiet' | 'clipping' | null>(null);
  const [peaks, setPeaks] = useState<number[]>(() => Array(LIVE_BARS).fill(0.05));
  const [interrupted, setInterrupted] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const countInSec = bpm ? (4 * 60) / Number(bpm) : 0;

  useEffect(() => {
    const subs = [
      Audio.addListener('level', (e) => {
        setLevel(e.meter);
        setPeaks((p) => [...p.slice(1), Math.max(0.05, e.meter)]);
      }),
      Audio.addListener('inputWarning', (e) => setWarning(e.kind)),
      Audio.addListener('interruption', (e) => e.recordingStopped && setInterrupted(true)),
    ];
    const t = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    return () => {
      subs.forEach((s) => s.remove());
      clearInterval(t);
    };
  }, [startedAt]);

  const stop = async () => {
    setStopping(true);
    const project = await finishTake();
    router.replace({ pathname: '/take/transcribing', params: { projectId: project.id } });
  };

  const counting = elapsed < countInSec;
  const shown = Math.max(0, elapsed - countInSec);

  return (
    <Screen scroll={false}>
      <View style={{ alignItems: 'center', marginTop: space[6], gap: space[1] }}>
        <Text variant="eyebrow" color="record" accessibilityLiveRegion="polite">
          ● Recording · take {take}
        </Text>
        <Text variant="largeTitle" align="center" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="callout" color="inkMuted">
          {counting ? `Count-in… ${Math.ceil(countInSec - elapsed)}` : "Just play — we'll write it down"}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Waveform peaks={peaks} height={140} progress={1} label="Live input" />
      </View>
      <View style={{ gap: space[4] }}>
        <Text variant="numeral" align="center" style={{ fontVariant: ['tabular-nums'] }} accessibilityLabel={`Elapsed ${formatClock(shown)}`}>
          {formatClock(shown)}
        </Text>
        <LevelMeter level={level} warning={warning} />
        {interrupted ? (
          <View style={{ gap: space[2] }}>
            <Text variant="callout" align="center">
              Recording stopped by an interruption. Your take is saved.
            </Text>
            <Button label="Keep it" onPress={stop} />
            <Button
              label="Record again"
              variant="ghost"
              onPress={async () => {
                await discardTake();
                router.back();
              }}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: space[3] }}>
            <RecordButton recording onPress={stop} disabled={stopping} />
            <Text variant="footnote" color="inkMuted" align="center">
              Saved as you play · keeps going if your screen locks · Up to 10 minutes
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
