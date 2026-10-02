import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useLibrary } from '@/data/store';
import { exportScore, type ExportKind } from '@/features/notes/exporters';
import { useNotesEntry } from '@/features/notes/notesStore';
import ScoreView from '@/features/notes/ScoreView';
import { useProjectScore } from '@/features/notes/useProjectScore';
import { radius, space, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Icon } from '@/ui/Icon';
import { IconTile } from '@/ui/IconTile';
import { SHEET_DETENTS, Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

const OPTIONS: { kind: ExportKind; title: string; body: string; icon: 'file' | 'note' | 'piano'; cta: string }[] = [
  { kind: 'pdf', title: 'Sheet music', body: 'PDF — print it or send it to your teacher', icon: 'file', cta: 'Share PDF' },
  { kind: 'musicxml', title: 'MusicXML', body: 'Open it in notation apps like MuseScore', icon: 'note', cta: 'Share MusicXML' },
  { kind: 'midi', title: 'MIDI', body: 'Play it in GarageBand or a digital piano app', icon: 'piano', cta: 'Share MIDI' },
];

export default function Share() {
  const { colors } = useTheme();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const project = useLibrary((s) => s.projects.find((p) => p.id === projectId));
  const entry = useNotesEntry(projectId);
  const score = useProjectScore(projectId, entry.settings, entry.edits);
  const [kind, setKind] = useState<ExportKind>('pdf');
  const [svg, setSvg] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const title = project?.name ?? 'Aria';
  const opt = OPTIONS.find((o) => o.kind === kind)!;

  return (
    <Sheet
      detent={SHEET_DETENTS.share}
      title="Share your notes"
      subtitle={title}
      footer={
        <View style={{ gap: space[2] }}>
          {error ? (
            <Text variant="footnote" color="warning" align="center">
              {error}
            </Text>
          ) : null}
          <Button
            label={opt.cta}
            icon="share"
            disabled={!score}
            onPress={async () => {
              if (!score) return;
              setError(null);
              try {
                await exportScore(kind, score.build, title, svg);
                router.back();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Sharing failed');
              }
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[1] }}>
            <Icon name="check" size={14} color="inkMuted" />
            <Text variant="footnote" color="inkMuted">
              Only leaves your phone when you share it.
            </Text>
          </View>
        </View>
      }>
      <View style={{ gap: space[3] }} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const on = o.kind === kind;
          return (
            <Pressable key={o.kind} onPress={() => setKind(o.kind)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
              <Glass
                padding={space[4]}
                shadow={false}
                style={[{ flexDirection: 'row', alignItems: 'center', gap: space[3] }, on && { borderColor: colors.primary, borderWidth: 2 }]}>
                <IconTile icon={o.icon} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="headline">{o.title}</Text>
                  <Text variant="footnote" color="inkMuted">
                    {o.body}
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: radius.pill,
                    borderWidth: 2,
                    borderColor: on ? colors.primary : colors.lineStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
                </View>
              </Glass>
            </Pressable>
          );
        })}
      </View>
      {/* Off-screen engraving for the PDF (black on white, print scale). */}
      {score && kind === 'pdf' ? (
        <View style={{ height: 1, overflow: 'hidden', opacity: 0 }} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <ScoreView
            mei={score.build.mei}
            ink="#111111"
            accent="#111111"
            accentSoft="#111111"
            scale={35}
            onSvg={setSvg}
            dom={{ style: { width: 700, height: 1 } }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
