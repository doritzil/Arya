import type { FallNote } from '@aria/score-engine';
import { memo, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { radius, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import { keyLabel, layoutKeys, soundingAt, type KeyRect } from './geometry';

const CHUNK_SEC = 8;
const KEYS_H = 118;

/**
 * Keyboard mode's falling notes (§6.6). Notes are laid out once in chunks of CHUNK_SEC seconds; each
 * frame only translates the note field by the clock (UI thread). The JS thread wakes only when the
 * visible chunk or the set of sounding notes changes.
 */
export function FallingKeys({
  notes,
  now,
  low,
  high,
  width,
  height,
  spanSec,
  reduceMotion,
}: {
  notes: FallNote[];
  /** Visual time in seconds (already latency-corrected), driven on the UI thread. */
  now: SharedValue<number>;
  low: number;
  high: number;
  width: number;
  height: number;
  /** Seconds of music visible above the keys. */
  spanSec: number;
  reduceMotion: boolean;
}) {
  const { colors } = useTheme();
  const keys = useMemo(() => layoutKeys(low, high, width), [low, high, width]);
  const keyByPitch = useMemo(() => new Map(keys.map((k) => [k.pitch, k])), [keys]);
  const fallH = Math.max(40, height - KEYS_H);
  const pps = fallH / spanSec;

  const chunks = useMemo(() => {
    const out: FallNote[][] = [];
    for (const n of notes) (out[Math.floor(n.startSec / CHUNK_SEC)] ??= []).push(n);
    return out;
  }, [notes]);

  const [chunk, setChunk] = useState(0);
  const [lit, setLit] = useState<FallNote[]>([]);
  const [upNext, setUpNext] = useState<FallNote[]>([]);

  function updateLit(t: number) {
    const s = soundingAt(notes, t);
    setLit((cur) => (sameSet(cur, s) ? cur : s));
    if (reduceMotion) {
      const next = notes.filter((n) => n.startSec > t && n.startSec <= t + spanSec).slice(0, 12);
      setUpNext((cur) => (sameSet(cur, next) ? cur : next));
    }
  }

  useAnimatedReaction(
    () => Math.floor(now.value / CHUNK_SEC),
    (c, prev) => {
      if (c !== prev) scheduleOnRN(setChunk, c);
    },
  );
  // Lit keys: recompute ~20×/s on the JS thread; cheap (binary search + short scan).
  useAnimatedReaction(
    () => Math.floor(now.value * 20),
    (tick, prev) => {
      if (tick !== prev) scheduleOnRN(updateLit, tick / 20);
    },
  );
  const fieldStyle = useAnimatedStyle(() => ({ transform: [{ translateY: now.value * pps }] }));
  const litPitches = new Map(lit.map((n) => [n.pitch, n]));
  const visible = [chunk - 1, chunk, chunk + 1, chunk + 2].filter((c) => c >= 0 && chunks[c]);

  return (
    <View style={{ width, height }}>
      {/* Note field: origin at the top edge of the keys; notes sit at negative y = time into the future. */}
      <View style={{ height: fallH, overflow: 'hidden' }}>
        {reduceMotion ? (
          <UpNext notes={upNext} keyByPitch={keyByPitch} height={fallH} colors={colors} />
        ) : (
          <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: fallH, height: 0 }, fieldStyle]}>
            {visible.map((c) => (
              <Chunk key={c} notes={chunks[c]!} keyByPitch={keyByPitch} pps={pps} left={colors.accent} right={colors.peach} />
            ))}
          </Animated.View>
        )}
      </View>
      <Keys keys={keys} lit={litPitches} height={KEYS_H} />
    </View>
  );
}

const Chunk = memo(function Chunk({
  notes,
  keyByPitch,
  pps,
  left,
  right,
}: {
  notes: FallNote[];
  keyByPitch: Map<number, KeyRect>;
  pps: number;
  left: string;
  right: string;
}) {
  return (
    <>
      {notes.map((n, i) => {
        const k = keyByPitch.get(n.pitch);
        if (!k) return null;
        const h = Math.max(8, (n.endSec - n.startSec) * pps - 2);
        const color = n.hand === 'L' ? left : right;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: k.x + k.width * 0.12,
              width: k.width * 0.76,
              top: -n.endSec * pps,
              height: h,
              borderRadius: Math.min(radius.sm, k.width * 0.38),
              backgroundColor: color,
              shadowColor: color,
              shadowOpacity: 0.8,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </>
  );
});

function Keys({ keys, lit, height }: { keys: KeyRect[]; lit: Map<number, FallNote>; height: number }) {
  const { colors } = useTheme();
  const fill = (n: FallNote | undefined, black: boolean) =>
    n ? (n.hand === 'L' ? colors.accent : colors.peach) : black ? colors.keyBlack : colors.keyWhite;
  return (
    <View style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {keys
        .filter((k) => !k.black)
        .map((k) => {
          const n = lit.get(k.pitch);
          return (
            <View
              key={k.pitch}
              style={{
                position: 'absolute',
                left: k.x + 1,
                width: k.width - 2,
                top: 0,
                height,
                borderBottomLeftRadius: 6,
                borderBottomRightRadius: 6,
                backgroundColor: fill(n, false),
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingBottom: 6,
              }}>
              {n ? (
                <Text variant="caption" style={{ color: colors.onAccent, marginBottom: 22 }}>
                  {keyLabel(n)}
                </Text>
              ) : null}
              {k.pitch % 12 === 0 ? (
                <Text variant="caption" style={{ color: colors.inkMuted, fontSize: 10, opacity: 0.6 }}>
                  C{Math.floor(k.pitch / 12) - 1}
                </Text>
              ) : null}
            </View>
          );
        })}
      {keys
        .filter((k) => k.black)
        .map((k) => {
          const n = lit.get(k.pitch);
          return (
            <View
              key={k.pitch}
              style={{
                position: 'absolute',
                left: k.x,
                width: k.width,
                top: 0,
                height: height * 0.62,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
                backgroundColor: fill(n, true),
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingBottom: 4,
              }}>
              {n ? (
                <Text variant="caption" style={{ color: colors.onAccent, fontSize: 10 }}>
                  {keyLabel(n)}
                </Text>
              ) : null}
            </View>
          );
        })}
    </View>
  );
}

/** Reduce Motion: upcoming notes as a static strip of named chips above their keys. */
function UpNext({
  notes,
  keyByPitch,
  height,
  colors,
}: {
  notes: FallNote[];
  keyByPitch: Map<number, KeyRect>;
  height: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="footnote" color="inkMuted" style={{ margin: 4 }}>
        Up next
      </Text>
      {notes.map((n, i) => {
        const k = keyByPitch.get(n.pitch);
        if (!k) return null;
        const size = Math.max(26, k.width);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: k.x + k.width / 2 - size / 2,
              top: height - size - 12 - (i % 3) * (size + 6),
              width: size,
              height: size,
              borderRadius: 8,
              backgroundColor: n.hand === 'L' ? colors.accent : colors.peach,
              opacity: 1 - i * 0.05,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text variant="caption" style={{ color: colors.onAccent }}>
              {keyLabel(n)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function sameSet(a: FallNote[], b: FallNote[]) {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}
