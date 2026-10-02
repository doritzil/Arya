import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import ScoreView from '@/features/notes/ScoreView';
import type { ProjectScore } from '@/features/notes/useProjectScore';
import { usePlayback } from '@/playback/coordinator';
import { space, useTheme } from '@/theme';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

/** Tall enough for two systems; longer pieces scroll inside it and follow playback. */
const SHEET_HEIGHT = 320;

/**
 * The song page's "My notes" view (FR-32): the take's sheet music in place of the waveform, the notes
 * glowing as the piano plays them (FR-15), and a way into Your notes to edit or share.
 */
export function NotesSheet({ projectId, score, sourceKey }: { projectId: string; score: ProjectScore | null; sourceKey: string }) {
  const { colors } = useTheme();
  const active = usePlayback((s) => s.source?.key === sourceKey);
  const position = usePlayback((s) => (active ? s.positionSec : -1));

  const currentIds = useMemo(() => {
    if (!score || position < 0) return [];
    const beat = score.build.beatMap.secToBeat(position);
    return score.build.model.notes.filter((n) => n.beat <= beat && beat < n.beat + n.beats).map((n) => n.id);
  }, [score, position]);

  return (
    <View style={{ gap: space[2] }}>
      <Glass padding={space[3]} style={{ height: SHEET_HEIGHT + space[3] * 2, justifyContent: 'center' }}>
        {score ? (
          <ScoreView
            mei={score.build.mei}
            currentIds={currentIds}
            ink={colors.ink}
            accent={colors.accent}
            accentSoft={colors.accentSoft}
            viewportHeight={SHEET_HEIGHT}
            dom={{ scrollEnabled: false, style: { height: SHEET_HEIGHT } }}
          />
        ) : (
          <Text variant="callout" color="inkMuted" align="center">
            Opening your notes…
          </Text>
        )}
      </Glass>
      {score ? (
        <Pressable
          onPress={() => router.push(`/record/${projectId}`)}
          accessibilityRole="button"
          accessibilityLabel={`${score.build.diagnostics.noteCount} notes, ${score.build.model.barCount} bars. Open to edit or share`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'center', paddingVertical: space[1] }}>
          <Text variant="footnote" color="inkMuted">
            {score.build.diagnostics.noteCount} notes · {score.build.model.barCount} bars · Edit or share
          </Text>
          <Icon name="chevron-right" size={14} color="inkMuted" />
        </Pressable>
      ) : null}
    </View>
  );
}
