import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { usePlayback, usePlaybackError, usePlaybackMode, type Source } from '@/playback/coordinator';
import { space } from '@/theme';
import { Icon, type IconName } from '@/ui/Icon';
import { PlayDisc } from '@/ui/PlayDisc';
import { Scrubber } from '@/ui/Scrubber';
import { Text } from '@/ui/Text';
import { Waveform } from '@/ui/Waveform';

/**
 * The full-screen player on a song's page (FR-29–31, FR-34): eyebrow → hero title → subtitle →
 * waveform (or `visual`, e.g. the score) → scrubber → Loop · play disc · Back 5s. Sits straight on the gradient.
 */
export function NowPlaying({
  eyebrow,
  title,
  subtitle,
  source,
  fallbackDuration,
  seed,
  visual,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  source: Source;
  fallbackDuration: number;
  seed: number;
  /** Replaces the waveform. */
  visual?: ReactNode;
}) {
  const active = usePlayback((s) => s.source?.key === source.key);
  const status = usePlayback((s) => s.status);
  const position = usePlayback((s) => (active ? s.positionSec : 0));
  const duration = usePlayback((s) => (active && s.durationSec ? s.durationSec : fallbackDuration));
  const loop = usePlayback((s) => s.loop);
  const { toggle, seek, skipBack, setLoop, play } = usePlayback.getState();
  const playing = active && (status === 'playing' || status === 'loading');
  const mode = usePlaybackMode(source.key);
  const error = usePlaybackError(source.key);

  return (
    <View style={{ alignItems: 'stretch', gap: space[2] }}>
      <Text variant="eyebrow" color="inkMuted" align="center">
        {eyebrow}
      </Text>
      <Text variant="hero" align="center" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
        {title}
      </Text>
      <Text variant="body" color="inkMuted" align="center" numberOfLines={1}>
        {subtitle}
      </Text>
      <View style={{ marginVertical: space[4] }}>
        {visual ?? <Waveform seed={seed} height={80} progress={duration ? position / duration : 0} />}
      </View>
      <Scrubber
        position={position}
        duration={duration}
        onSeek={(s) => (active ? seek(s) : play(source).then(() => seek(s)))}
      />
      {mode === 'preview' ? (
        <Text variant="footnote" color="warning" align="center" accessibilityLiveRegion="polite">
          Preview · the full song plays in Apple Music
        </Text>
      ) : null}
      {error ? (
        <Text variant="footnote" color="warning" align="center" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: space[3] }}>
        <SideControl
          icon="repeat"
          label={loop ? 'Loop on' : 'Loop'}
          a11y={loop ? 'Loop is on' : 'Loop is off'}
          selected={loop}
          onPress={() => setLoop(!loop)}
        />
        <PlayDisc size="large" playing={playing} label={`${playing ? 'Pause' : 'Play'} ${title}`} onPress={() => toggle(source)} />
        <SideControl icon="back" label="Back 5s" a11y="Back 5 seconds" onPress={() => skipBack(5)} />
      </View>
    </View>
  );
}

function SideControl({
  icon,
  label,
  a11y,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  a11y: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={selected === undefined ? 'button' : 'switch'}
      accessibilityLabel={a11y}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      style={{ alignItems: 'center', gap: space[1], minWidth: 88, minHeight: 44 }}>
      <Icon name={icon} size={26} warm />
      <Text variant="callout" weight={selected ? 600 : 500}>
        {label}
      </Text>
    </Pressable>
  );
}
