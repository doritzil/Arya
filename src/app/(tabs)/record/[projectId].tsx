import { summaryLabel, type ScoreNote } from '@aria/score-engine';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { takeFiles } from '@/features/record/takeFiles';
import { useLibrary } from '@/data/store';
import { startTranscription } from '@/features/record/session';
import { useNotesEntry } from '@/features/notes/notesStore';
import { PianoRoll } from '@/features/notes/PianoRoll';
import ScoreView from '@/features/notes/ScoreView';
import { useProjectScore } from '@/features/notes/useProjectScore';
import { formatShortDate, formatTime } from '@/lib/format';
import { usePlayback, type Source } from '@/playback/coordinator';
import { radius, space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { SourceSwitch } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { IconButton } from '@/ui/IconButton';
import { PlayDisc } from '@/ui/PlayDisc';
import { Screen, TopBar } from '@/ui/Screen';
import { Text } from '@/ui/Text';

/** Your notes (FR-9–17): summary chip, Score / Piano roll, A/B player, Edit, Save. */
export default function YourNotes() {
  const { colors } = useTheme();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const project = useLibrary((s) => s.projects.find((p) => p.id === projectId));
  const song = useLibrary((s) => (project?.songId ? s.songs.find((x) => x.id === project.songId) : undefined));
  const entry = useNotesEntry(projectId);
  const ready = project?.transcriptionStatus === 'done';
  const score = useProjectScore(ready ? projectId : undefined, entry.settings, entry.edits);
  const [view, setView] = useState(0);
  const [ab, setAb] = useState(1); // 0 = My recording, 1 = Piano (FR-16)

  const title = project?.name.split(' — ')[0] ?? '';
  const pb = usePlayback();
  const sources: Source[] = score
    ? [
        { kind: 'recording', key: `rec:${projectId}`, title, uri: takeFiles.audioUri(projectId) },
        { kind: 'synth', key: `synth:${projectId}`, title, notes: score.synthNotes },
      ]
    : [];
  const src = sources[ab];
  const active = !!src && sources.some((s) => s.key === pb.source?.key);
  const playing = active && pb.source?.key === src?.key && pb.status === 'playing';

  // The note(s) sounding now, for the score glow and piano-roll highlight (FR-15).
  const currentIds = useMemo(() => {
    if (!score || !active) return new Set<string>();
    const beat = score.build.beatMap.secToBeat(pb.positionSec);
    return new Set(score.build.model.notes.filter((n) => n.beat <= beat && beat < n.beat + n.beats).map((n) => n.id));
  }, [score, active, pb.positionSec]);

  if (!project) {
    return (
      <Screen tabBar>
        <TopBar />
        <Text variant="title2">This recording was deleted.</Text>
      </Screen>
    );
  }

  const switchAb = (i: number) => {
    setAb(i);
    const next = sources[i];
    if (active && next) {
      // Same time base for both — keep the position when switching (FR-16).
      const at = pb.positionSec;
      pb.play(next).then(() => pb.seek(at));
    }
  };

  return (
    <Screen tabBar>
      <TopBar
        title={`${formatShortDate(project.createdAt)}, ${new Date(project.createdAt).getFullYear()} · ${formatTime(project.createdAt)}`}
        onBack={() => router.navigate('/record')}
        right={
          <IconButton
            icon="export"
            label="Share your notes"
            disabled={!ready}
            onPress={() => router.push({ pathname: '/sheets/share', params: { projectId } })}
          />
        }
      />
      <Text variant="largeTitle" accessibilityRole="header">
        {title}
      </Text>

      {!ready ? (
        <NotReady status={project.transcriptionStatus} onStart={() => startTranscription(project, takeFiles.audioUri(project.id))} />
      ) : !score ? (
        <Text variant="callout" color="inkMuted" style={{ marginTop: space[4] }}>
          Opening your notes…
        </Text>
      ) : (
        <>
          <Pressable
            onPress={() => router.push({ pathname: '/sheets/how-its-written', params: { projectId } })}
            accessibilityRole="button"
            accessibilityLabel={`How it's written: ${summaryLabel(score.build.model)}. Tap to change`}
            style={{
              alignSelf: 'flex-start',
              marginTop: space[2],
              paddingHorizontal: space[3],
              height: 32,
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: colors.glassStrong,
              borderWidth: 1,
              borderColor: colors.glassEdge,
            }}>
            <Text variant="footnote" weight={500}>
              {summaryLabel(score.build.model)}
            </Text>
          </Pressable>

          <View style={{ marginTop: space[4] }}>
            <SourceSwitch options={['Score', 'Piano roll']} value={view} onChange={setView} />
          </View>

          <Glass padding={space[3]} style={{ marginTop: space[3], minHeight: 180 }}>
            {view === 0 ? (
              <ScoreView
                mei={score.build.mei}
                currentIds={[...currentIds]}
                ink={colors.ink}
                accent={colors.accent}
                accentSoft={colors.accentSoft}
                dom={{ scrollEnabled: false, style: { minHeight: 200 }, matchContents: true }}
              />
            ) : (
              <PianoRoll notes={score.build.model.notes as ScoreNote[]} currentIds={currentIds} />
            )}
          </Glass>

          <Glass padding={space[3]} style={{ marginTop: space[3], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <PlayDisc
              playing={playing}
              label={playing ? 'Pause' : ab === 0 ? 'Play my recording' : 'Play on piano'}
              onPress={() => src && pb.toggle(src)}
            />
            <View style={{ flex: 1 }}>
              <SourceSwitch options={['My recording', 'Piano']} value={ab} onChange={switchAb} />
            </View>
          </Glass>

          <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[4] }}>
            <Button label="Edit" icon="pencil" variant="secondary" onPress={() => router.push(`/edit/${projectId}`)} />
            <Button
              label={song ? `Save to ${song.title}` : 'Save'}
              icon="check"
              style={{ flex: 1 }}
              onPress={() => router.navigate(song ? `/learning/${song.id}` : '/record')}
            />
          </View>
          <Text variant="footnote" color="inkMuted" style={{ marginTop: space[2] }}>
            {score.build.diagnostics.noteCount} notes · {score.build.model.barCount} bars
            {score.build.diagnostics.droppedEdits ? ` · ${score.build.diagnostics.droppedEdits} edits no longer apply` : ''}
          </Text>
        </>
      )}
    </Screen>
  );
}

function NotReady({ status, onStart }: { status: string; onStart: () => void }) {
  if (status === 'running' || status === 'queued') {
    return (
      <Glass padding={space[5]} style={{ marginTop: space[4], gap: space[3] }}>
        <Text variant="headline">Your notes are on the way…</Text>
        <Button label="See progress" variant="secondary" onPress={() => router.back()} />
      </Glass>
    );
  }
  return (
    <Glass padding={space[5]} style={{ marginTop: space[4], gap: space[3] }}>
      <Text variant="headline">{status === 'failed' ? "Notes didn't work for this take" : 'No notes yet'}</Text>
      <Text variant="callout" color="inkMuted">
        Aria writes the notes on your phone — it takes a few seconds and works offline.
      </Text>
      <Button label={status === 'failed' ? 'Try again' : 'Turn it into notes'} icon="note" onPress={onStart} />
    </Glass>
  );
}
