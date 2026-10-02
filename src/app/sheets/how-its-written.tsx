import { keyLabel, type Grid, type TimeSig } from '@aria/score-engine';
import { router, useLocalSearchParams } from 'expo-router';
import { Switch, View } from 'react-native';

import { useNotes, useNotesEntry } from '@/features/notes/notesStore';
import { useProjectScore } from '@/features/notes/useProjectScore';
import { space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { SourceSwitch } from '@/ui/Chips';
import { IconButton } from '@/ui/IconButton';
import { SHEET_DETENTS, Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const TIME_SIGS: TimeSig[] = ['2/4', '3/4', '4/4', '6/8'];
const GRIDS: { key: Grid; label: string }[] = [
  { key: 'quarter', label: 'Quarter' },
  { key: 'eighth', label: 'Eighth' },
  { key: 'sixteenth', label: 'Sixteenth' },
];
// Circle of fifths, flats → sharps, for the key stepper.
const KEYS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

/** FR-9–11, FR-19: re-generates the score without re-running the model; every change is undoable. */
export default function HowItsWritten() {
  const { colors } = useTheme();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const entry = useNotesEntry(projectId);
  const setSettings = useNotes((s) => s.setSettings);
  const score = useProjectScore(projectId, entry.settings, entry.edits);
  const s = entry.settings;
  const model = score?.build.model;
  const d = score?.build.diagnostics;
  const tempo = Math.round(model?.settings.tempoBpm ?? s.tempoBpm ?? 80);
  const fifths = model?.settings.keyFifths ?? 0;
  const mode = model?.settings.keyMode ?? 'major';
  const set = (patch: Parameters<typeof setSettings>[1]) => setSettings(projectId, patch);

  return (
    <Sheet
      detent={SHEET_DETENTS.howItsWritten}
      title="How it's written"
      subtitle="We guessed these from your playing. Change anything — the score updates right away."
      footer={<Button label="Done" onPress={() => router.back()} />}>
      <View style={{ gap: space[5] }}>
        <Section title="Tempo" hint={d && s.tempoBpm === undefined ? 'Detected' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <IconButton icon="minus" size="small" label="Slower" onPress={() => set({ tempoBpm: Math.max(40, tempo - 2) })} />
            <Text variant="title2" style={{ flex: 1, textAlign: 'center' }} accessibilityLiveRegion="polite">
              ♩ = {tempo} BPM
            </Text>
            <IconButton icon="plus" size="small" label="Faster" onPress={() => set({ tempoBpm: Math.min(200, tempo + 2) })} />
          </View>
        </Section>
        <Section title="Time signature">
          <SourceSwitch
            options={TIME_SIGS}
            value={TIME_SIGS.indexOf(s.timeSig)}
            onChange={(i) => set({ timeSig: TIME_SIGS[i] })}
          />
        </Section>
        <Section title="Key" hint={s.keyFifths === undefined ? 'Detected' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <IconButton
              icon="minus"
              size="small"
              label="One more flat"
              onPress={() => set({ keyFifths: KEYS[Math.max(0, KEYS.indexOf(fifths) - 1)], keyMode: mode })}
            />
            <Text variant="headline" style={{ flex: 1, textAlign: 'center' }}>
              {keyLabel(fifths, mode)}
            </Text>
            <IconButton
              icon="plus"
              size="small"
              label="One more sharp"
              onPress={() => set({ keyFifths: KEYS[Math.min(KEYS.length - 1, KEYS.indexOf(fifths) + 1)], keyMode: mode })}
            />
          </View>
          <View style={{ marginTop: space[2] }}>
            <SourceSwitch
              options={['Major', 'Minor']}
              value={mode === 'major' ? 0 : 1}
              onChange={(i) => set({ keyFifths: fifths, keyMode: i === 0 ? 'major' : 'minor' })}
            />
          </View>
        </Section>
        <Section title="Shortest note">
          <SourceSwitch
            options={GRIDS.map((g) => g.label)}
            value={GRIDS.findIndex((g) => g.key === s.grid)}
            onChange={(i) => set({ grid: GRIDS[i]!.key })}
          />
        </Section>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="headline">Triplets</Text>
            <Text variant="footnote" color="inkMuted">
              Allow groups of three
            </Text>
          </View>
          <Switch
            value={s.triplets}
            onValueChange={(v) => set({ triplets: v })}
            trackColor={{ true: colors.accent, false: colors.track }}
          thumbColor={colors.keyWhite}
            accessibilityLabel="Triplets"
          />
        </View>
        {d ? (
          <Text variant="footnote" color="inkMuted">
            Rewritten in {d.elapsedMs} ms
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="headline">{title}</Text>
        {hint ? (
          <Text variant="footnote" color="inkMuted">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
