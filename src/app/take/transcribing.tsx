import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useLibrary } from '@/data/store';
import { cancelTranscription } from '@/features/record/session';
import { formatDuration } from '@/lib/format';
import { radius, space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { Waveform } from '@/ui/Waveform';

// The model is ~85% of the work; the score engine stages are near-instant and tick off at the end.
const STEPS = [
  { label: 'Listening for notes', until: 0.85 },
  { label: 'Finding the beat', until: 0.92 },
  { label: 'Working out the key', until: 0.97 },
  { label: 'Writing the score', until: 1 },
];

export default function Transcribing() {
  const { colors } = useTheme();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const project = useLibrary((s) => s.projects.find((p) => p.id === projectId));
  const status = project?.transcriptionStatus;
  const progress = status === 'done' ? 1 : (project?.transcriptionProgress ?? 0) * 0.85;
  const done = status === 'done';
  const failed = status === 'failed';
  const title = project?.name.split(' — ')[0] ?? '';

  return (
    <Screen
      scroll={false}
      footer={
        done ? (
          <Button label="See your notes" icon="note" onPress={() => router.replace(`/record/${projectId}`)} />
        ) : failed ? (
          <Button label="Back to recordings" variant="secondary" onPress={() => router.replace('/record')} />
        ) : (
          <Button label="Keep going in the background" variant="ghost" onPress={() => router.replace('/record')} />
        )
      }>
      <View style={{ alignItems: 'center', gap: space[1], marginTop: space[5] }}>
        <Text variant="eyebrow" color="inkMuted">
          {title} · {formatDuration(project?.durationSec ?? 0)} recorded
        </Text>
        <Text variant="largeTitle" align="center" accessibilityRole="header">
          {done ? 'Your notes are ready' : failed ? "That didn't work" : 'Turning it into notes'}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Waveform seed={(project?.createdAt ?? 1) % 97} height={110} progress={progress} />
      </View>
      <Glass padding={space[5]} style={{ gap: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="numeral" style={{ flex: 1 }} accessibilityLabel={`${Math.round(progress * 100)} percent`} accessibilityLiveRegion="polite">
            {Math.round(progress * 100)}%
          </Text>
          {!done && !failed ? (
            <Button
              label="Cancel"
              variant="ghost"
              size="small"
              onPress={() => {
                cancelTranscription(projectId);
                router.replace('/record');
              }}
            />
          ) : null}
        </View>
        <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: 6, backgroundColor: colors.accent }} />
        </View>
        <View style={{ gap: space[2] }}>
          {STEPS.map((s, i) => {
            const prev = STEPS[i - 1]?.until ?? 0;
            const state = progress >= s.until ? 'done' : progress >= prev ? 'now' : 'todo';
            return (
              <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                {state === 'done' ? (
                  <Icon name="check" size={16} color="success" />
                ) : (
                  <View style={{ width: 16, alignItems: 'center' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: state === 'now' ? colors.accent : colors.track }} />
                  </View>
                )}
                <Text variant="callout" color={state === 'todo' ? 'inkMuted' : 'ink'} weight={state === 'now' ? 600 : 400}>
                  {s.label}
                  {state === 'now' ? '…' : ''}
                </Text>
              </View>
            );
          })}
        </View>
        {failed ? (
          <Text variant="callout" color="warning">
            We couldn&apos;t turn this take into notes. Your recording is safe — you can try again from Recordings.
          </Text>
        ) : null}
      </Glass>
      <Text variant="footnote" color="inkMuted" align="center" style={{ marginTop: space[3] }}>
        Happening on your phone — works offline, nothing is uploaded. You can leave this screen; we&apos;ll let you know.
      </Text>
    </Screen>
  );
}
