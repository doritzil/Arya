import { baseNoteId, stepPitchInKey, type ScoreNote } from '@aria/score-engine';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useLibrary } from '@/data/store';
import { canRedo, canUndo, useNotes, useNotesEntry } from '@/features/notes/notesStore';
import ScoreView from '@/features/notes/ScoreView';
import { useProjectScore } from '@/features/notes/useProjectScore';
import { space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { SourceSwitch } from '@/ui/Chips';
import { Glass } from '@/ui/Glass';
import { IconButton } from '@/ui/IconButton';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';

const LENGTHS = [
  { beats: 0.5, label: 'Eighth' },
  { beats: 1, label: 'Quarter' },
  { beats: 2, label: 'Half' },
];
const LENGTH_NAME: Record<number, string> = { 0.25: 'sixteenth', 0.5: 'eighth', 1: 'quarter', 1.5: 'dotted quarter', 2: 'half', 3: 'dotted half', 4: 'whole' };

/** Edit a note (FR-18, FR-20): tap a note, change pitch (steps within the key) or length, add, delete. */
export default function EditNotes() {
  const { colors } = useTheme();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const project = useLibrary((s) => s.projects.find((p) => p.id === projectId));
  const updateProject = useLibrary((s) => s.updateProject);
  const entry = useNotesEntry(projectId);
  const { edit, undo, redo } = useNotes.getState();
  const score = useProjectScore(projectId, entry.settings, entry.edits);
  const notes = (score?.build.model.notes ?? []) as ScoreNote[];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const model = score?.build.model;

  const apply = (op: Parameters<typeof edit>[1]) => {
    edit(projectId, op);
    if (!project?.hasEdits) updateProject(projectId, { hasEdits: true });
  };
  const newId = () => `u${Date.now().toString(36)}`;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[3] }}>
        <Button label="Done" variant="ghost" size="small" onPress={() => router.back()} />
        <Text variant="callout" weight={500} style={{ flex: 1, textAlign: 'center' }} numberOfLines={1}>
          Editing · {project?.name.split(' — ')[0]}
        </Text>
        <IconButton icon="undo" size="small" label="Undo" disabled={!canUndo(projectId)} onPress={() => undo(projectId)} />
        <IconButton icon="redo" size="small" label="Redo" disabled={!canRedo(projectId)} onPress={() => redo(projectId)} />
      </View>
      <Text variant="footnote" color="inkMuted">
        Tap a note to change it. Changes update the score instantly — no need to record again.
      </Text>
      <Glass padding={space[3]} style={{ marginTop: space[3], minHeight: 200 }}>
        {score ? (
          <ScoreView
            mei={score.build.mei}
            selectedId={selectedId}
            ink={colors.ink}
            accent={colors.accent}
            accentSoft={colors.accentSoft}
            scale={48}
            onTapNote={(xmlId) => setSelectedId(baseNoteId(xmlId))}
            dom={{ scrollEnabled: false, matchContents: true, style: { minHeight: 220 } }}
          />
        ) : null}
      </Glass>

      <Glass padding={space[4]} style={{ marginTop: space[3], gap: space[4] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="eyebrow" color="inkMuted">
              Selected note
            </Text>
            <Text variant="title2" accessibilityLiveRegion="polite">
              {selected ? `${selected.name.replace('b', '♭').replace('#', '♯')} · ${LENGTH_NAME[selected.beats] ?? `${selected.beats} beats`}` : 'Tap a note'}
            </Text>
          </View>
          <IconButton
            icon="down"
            size="small"
            label="Pitch down"
            disabled={!selected || !model}
            onPress={() =>
              selected && model && apply({ t: 'pitch', noteId: selected.id, pitch: stepPitchInKey(selected.pitch, -1, model.settings.keyFifths, model.settings.keyMode) })
            }
          />
          <View style={{ width: space[2] }} />
          <IconButton
            icon="up"
            size="small"
            label="Pitch up"
            disabled={!selected || !model}
            onPress={() =>
              selected && model && apply({ t: 'pitch', noteId: selected.id, pitch: stepPitchInKey(selected.pitch, 1, model.settings.keyFifths, model.settings.keyMode) })
            }
          />
        </View>
        <View style={{ gap: space[2] }}>
          <Text variant="footnote" color="inkMuted">
            Length
          </Text>
          <SourceSwitch
            options={LENGTHS.map((l) => l.label)}
            value={LENGTHS.findIndex((l) => l.beats === selected?.beats)}
            onChange={(i) => selected && apply({ t: 'length', noteId: selected.id, beats: LENGTHS[i]!.beats })}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Button
            label="Add note"
            icon="plus"
            variant="ghost"
            size="small"
            disabled={!selected}
            onPress={() =>
              selected &&
              apply({ t: 'addNote', id: newId(), beat: selected.beat + selected.beats, pitch: selected.pitch, beats: 1, staff: selected.staff })
            }
          />
          <Button
            label="Add rest"
            icon="minus"
            variant="ghost"
            size="small"
            disabled={!selected}
            onPress={() => selected && apply({ t: 'addRest', id: newId(), beat: selected.beat + selected.beats, beats: 1, staff: selected.staff })}
          />
          <Button
            label="Delete"
            icon="trash"
            variant="ghost"
            size="small"
            disabled={!selected}
            onPress={() => {
              if (!selected) return;
              apply({ t: 'delete', noteId: selected.id });
              setSelectedId(null);
            }}
          />
        </View>
      </Glass>
    </Screen>
  );
}
