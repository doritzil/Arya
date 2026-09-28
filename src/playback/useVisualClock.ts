import { useEffect } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { usePlayback } from './coordinator';

/**
 * Smooth playback time on the UI thread (§6.4). Native clock events arrive ~10×/s; between them the
 * position is extrapolated from the last event, and the audio output latency is subtracted so what you
 * see lines up with what you hear (Bluetooth adds ~150–250 ms).
 */
export function useVisualClock(sourceKey: string) {
  const now = useSharedValue(0);
  const basePos = useSharedValue(0);
  const baseAt = useSharedValue(0);
  const rate = useSharedValue(1);
  const playing = useSharedValue(false);
  const latency = useSharedValue(0);

  useEffect(() => {
    const apply = (s: ReturnType<typeof usePlayback.getState>) => {
      const mine = s.source?.key === sourceKey;
      basePos.value = mine ? s.positionSec : 0;
      baseAt.value = performance.now();
      rate.value = s.rate;
      playing.value = mine && s.status === 'playing';
      latency.value = s.outputLatency;
    };
    apply(usePlayback.getState());
    return usePlayback.subscribe(apply);
  }, [sourceKey, basePos, baseAt, rate, playing, latency]);

  useFrameCallback(() => {
    const elapsed = playing.value ? ((performance.now() - baseAt.value) / 1000) * rate.value : 0;
    // Never run ahead of the next native tick by more than a quarter second.
    now.value = basePos.value + Math.min(elapsed, 0.25) - latency.value;
  });

  return now;
}
