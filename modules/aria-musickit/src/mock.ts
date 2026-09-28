/**
 * JS stand-in for MusicKit: authorizes after a short delay, reports a subscriber by default
 * (configurable), plays any id as a 3:30 track with a 10 Hz clock honouring seek/repeat.
 */
import type {
  AriaMusicKitApi,
  AriaMusicKitEvents,
  MusicAuthorization,
  MusicPlayerStatus,
  SubscriptionInfo,
} from './AriaMusicKit.types';
import { MockEmitter } from './emitter';

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

export interface AriaMusicKitMock extends AriaMusicKitApi {
  readonly isMock: true;
  configureMock(opts: { subscription?: SubscriptionInfo; authorization?: MusicAuthorization; trackDurationSec?: number }): void;
  dispose(): void;
}

export function createAriaMusicKitMock(): AriaMusicKitMock {
  const emitter = new MockEmitter<AriaMusicKitEvents>();
  let auth: MusicAuthorization = 'notDetermined';
  let sub: SubscriptionInfo = { canPlayCatalogContent: true, canBecomeSubscriber: false };
  let trackDuration = 210;

  const st = {
    id: undefined as string | undefined,
    status: 'idle' as MusicPlayerStatus,
    position: 0,
    repeat: false,
    last: 0,
    timer: null as ReturnType<typeof setInterval> | null,
  };

  const clock = () =>
    emitter.emit('clock', {
      position: st.position,
      hostTime: now(),
      wallTime: Date.now(),
      rate: st.status === 'playing' ? 1 : 0,
      status: st.status,
      duration: st.id ? trackDuration : 0,
      outputLatency: 0.005,
    });
  const stopTimer = () => {
    if (st.timer) clearInterval(st.timer);
    st.timer = null;
  };
  const tick = () => {
    const t = now();
    st.position += (t - st.last) / 1000;
    st.last = t;
    if (st.position >= trackDuration) {
      if (st.repeat) st.position %= trackDuration;
      else {
        st.position = trackDuration;
        st.status = 'ended';
        stopTimer();
        emitter.emit('state', { status: 'ended', appleMusicId: st.id });
      }
    }
    clock();
  };
  const startTimer = () => {
    stopTimer();
    st.last = now();
    st.timer = setInterval(tick, 100);
  };

  return {
    isMock: true,
    async requestAuthorization() {
      await new Promise((r) => setTimeout(r, 300));
      if (auth === 'notDetermined') auth = 'authorized';
      return auth;
    },
    authorizationStatus() {
      return auth;
    },
    async subscription() {
      return { ...sub };
    },
    async play(appleMusicId) {
      if (!sub.canPlayCatalogContent) throw new Error('Not a subscriber');
      emitter.emit('state', { status: 'loading', appleMusicId });
      await new Promise((r) => setTimeout(r, 250));
      st.id = appleMusicId;
      st.position = 0;
      st.status = 'playing';
      startTimer();
      emitter.emit('state', { status: 'playing', appleMusicId, duration: trackDuration });
      clock();
    },
    async resume() {
      if (!st.id || st.status === 'playing') return;
      if (st.status === 'ended') st.position = 0;
      st.status = 'playing';
      startTimer();
      emitter.emit('state', { status: 'playing', appleMusicId: st.id, duration: trackDuration });
      clock();
    },
    pause() {
      if (st.status !== 'playing') return;
      tick();
      stopTimer();
      st.status = 'paused';
      emitter.emit('state', { status: 'paused', appleMusicId: st.id });
      clock();
    },
    stop() {
      stopTimer();
      st.status = 'idle';
      st.position = 0;
      st.id = undefined;
      emitter.emit('state', { status: 'idle' });
      clock();
    },
    seek(sec) {
      st.position = Math.max(0, Math.min(sec, trackDuration));
      st.last = now();
      if (st.status === 'ended') st.status = 'paused';
      clock();
    },
    setRepeat(on) {
      st.repeat = on;
    },
    async listeningGenreWeights(): Promise<Record<string, number>> {
      return auth === 'authorized' ? { Pop: 0.38, Soundtrack: 0.27, Classical: 0.2, Rock: 0.15 } : {};
    },
    openInAppleMusic() {},
    addListener(event, cb) {
      return emitter.addListener(event, cb);
    },
    configureMock(opts) {
      if (opts.subscription) sub = opts.subscription;
      if (opts.authorization) auth = opts.authorization;
      if (opts.trackDurationSec) trackDuration = opts.trackDurationSec;
    },
    dispose() {
      stopTimer();
      emitter.removeAllListeners();
    },
  };
}
