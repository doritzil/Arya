/**
 * JS stand-in for the Swift `AriaAudio` module (web preview, Jest, Expo Go).
 * It writes no audio files; it simulates timing and events well enough to drive the UI:
 *  - recording: `level` at 20 Hz with a phrase-shaped envelope, a quiet stretch now and then
 *    (→ `inputWarning` 'quiet' after 1.5 s, cleared after 0.5 s of playing), count-in beats,
 *    the 9:30 warning / 10:00 auto-stop.
 *  - player: a clock advanced by setInterval (10 Hz `clock` events) honouring rate, loop and seek;
 *    `url` sources (Apple Music previews) also play real audio through expo-audio (fallbackSound.ts).
 */
import { MockEmitter } from './emitter';
import { createFallbackSound, type FallbackSound } from './fallbackSound';
import type {
  AriaAudioApi,
  AriaAudioEvents,
  AudioInput,
  LevelEvent,
  PlayerSource,
  PlayerStatus,
  RecordingResult,
  StartRecordingOptions,
} from './AriaAudio.types';

const LEVEL_HZ = 20;
const CLOCK_HZ = 10;
const QUIET_DB = -45;
const CLIP_DB = -1;
const WARN_AFTER_SEC = 1.5;
const CLEAR_AFTER_SEC = 0.5;

const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());
const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;
const toDb = (amp: number) => (amp <= 1e-8 ? -160 : 20 * Math.log10(amp));
export const dbToMeter = (db: number) => Math.min(1, Math.max(0, (db + 60) / 60));

/** Deterministic PRNG so peaks for a file are stable across calls. */
function seeded(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const MOCK_INPUTS: AudioInput[] = [
  { id: 'builtin-mic', name: 'iPhone Microphone', kind: 'builtIn', lowBandwidth: false, selected: true },
  { id: 'usb-mic', name: 'USB Audio Interface', kind: 'usb', lowBandwidth: false, selected: false },
];

export interface AriaAudioMock extends AriaAudioApi {
  readonly isMock: true;
  /** Stop all timers (tests). */
  dispose(): void;
  /** Test hook: force the next level frames quiet or clipping. */
  __forceInput(mode: 'normal' | 'quiet' | 'clipping'): void;
}

export function createAriaAudioMock(): AriaAudioMock {
  const emitter = new MockEmitter<AriaAudioEvents>();
  let sound: FallbackSound | null = null;
  let loadToken: object | null = null;
  let inputs = MOCK_INPUTS.map((i) => ({ ...i }));
  const durations = new Map<string, number>(); // file → duration of mock recordings/imports
  let permission: 'granted' | 'denied' | 'undetermined' = 'undetermined';

  // ---------------- recording ----------------
  let rec: {
    opts: StartRecordingOptions;
    startedAt: number;
    countInEndSec: number;
    timer: ReturnType<typeof setInterval>;
    beatTimers: ReturnType<typeof setTimeout>[];
    warnState: 'quiet' | 'clipping' | null;
    badSince: number | null;
    goodSince: number | null;
    limitWarned: boolean;
    interrupted: boolean;
  } | null = null;
  let lastResult: RecordingResult | null = null;
  let forced: 'normal' | 'quiet' | 'clipping' = 'normal';
  const rand = seeded('mic');

  function levelAt(t: number): LevelEvent {
    // Phrases ~6 s long with a 1 s breath; every ~23 s a 2.5 s quiet stretch (hand off keys).
    let amp: number;
    const phrase = t % 7;
    const quietStretch = t % 23 > 20.5;
    if (forced === 'quiet' || quietStretch) amp = 0.002 + rand() * 0.002;
    else if (phrase > 6) amp = 0.01 + rand() * 0.01;
    else {
      const env = Math.sin((Math.PI * phrase) / 6) ** 0.6; // swell and fade
      const beat = 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 1.6)); // note attacks
      amp = 0.04 + 0.22 * env * beat * (0.85 + rand() * 0.3);
    }
    let peakAmp = Math.min(1, amp * (1.8 + rand() * 1.2));
    if (forced === 'clipping') peakAmp = 0.995;
    const rms = toDb(amp);
    const peak = toDb(peakAmp);
    return { rms, peak, meter: dbToMeter(rms) };
  }

  function tickRecording() {
    if (!rec) return;
    const elapsed = (now() - rec.startedAt) / 1000;
    const lvl = levelAt(elapsed);
    emitter.emit('level', lvl);

    // hysteresis: a condition must hold 1.5 s to warn, and be gone 0.5 s to clear
    const bad: 'quiet' | 'clipping' | null =
      lvl.peak >= CLIP_DB ? 'clipping' : lvl.rms < QUIET_DB && elapsed > rec.countInEndSec ? 'quiet' : null;
    const t = now();
    if (bad) {
      rec.goodSince = null;
      if (rec.badSince == null) rec.badSince = t;
      if (rec.warnState !== bad && (t - rec.badSince) / 1000 >= (bad === 'clipping' ? 0.3 : WARN_AFTER_SEC)) {
        rec.warnState = bad;
        emitter.emit('inputWarning', { kind: bad });
      }
    } else {
      rec.badSince = null;
      if (rec.goodSince == null) rec.goodSince = t;
      if (rec.warnState && (t - rec.goodSince) / 1000 >= CLEAR_AFTER_SEC) {
        rec.warnState = null;
        emitter.emit('inputWarning', { kind: null });
      }
    }

    const max = rec.opts.maxDurationSec ?? 600;
    if (!rec.limitWarned && elapsed >= max - 30) {
      rec.limitWarned = true;
      emitter.emit('recordingStatus', { state: 'limitWarning', elapsedSec: elapsed });
    }
    if (elapsed >= max) {
      rec.interrupted = true;
      emitter.emit('recordingStatus', { state: 'autoStopped', elapsedSec: elapsed });
      finishRecording();
    }
  }

  function finishRecording(): RecordingResult | null {
    if (!rec) return lastResult;
    clearInterval(rec.timer);
    rec.beatTimers.forEach(clearTimeout);
    const durationSec = Math.max(0, (now() - rec.startedAt) / 1000);
    const file = joinPath(rec.opts.projectDir, 'audio.m4a');
    durations.set(file, durationSec);
    lastResult = {
      file,
      durationSec,
      countInEndSec: Math.min(rec.countInEndSec, durationSec),
      sampleRate: rec.opts.sampleRate ?? 48000,
      interrupted: rec.interrupted,
    };
    if (rec.warnState) emitter.emit('inputWarning', { kind: null });
    emitter.emit('recordingStatus', { state: 'stopped', elapsedSec: durationSec });
    rec = null;
    return lastResult;
  }

  // ---------------- player ----------------
  const player = {
    status: 'idle' as PlayerStatus,
    duration: 0,
    position: 0,
    rate: 1,
    loop: false,
    lastTick: 0,
    timer: null as ReturnType<typeof setInterval> | null,
  };

  function emitClock() {
    emitter.emit('clock', {
      position: player.position,
      hostTime: now(),
      wallTime: Date.now(),
      rate: player.status === 'playing' ? player.rate : 0,
      status: player.status,
      duration: player.duration,
      outputLatency: 0.005,
    });
  }

  function stopTimer() {
    if (player.timer) clearInterval(player.timer);
    player.timer = null;
  }

  function tickPlayer() {
    const t = now();
    player.position += ((t - player.lastTick) / 1000) * player.rate;
    player.lastTick = t;
    if (player.position >= player.duration) {
      if (player.loop && player.duration > 0) {
        player.position = player.position % player.duration;
      } else {
        player.position = player.duration;
        player.status = 'ended';
        stopTimer();
      }
    }
    emitClock();
  }

  function durationFor(source: PlayerSource): number {
    switch (source.kind) {
      case 'synth':
        return source.notes.reduce((m, n) => Math.max(m, n.endSec), 0) + 0.5;
      case 'url':
        return 30; // Apple Music previews
      case 'file':
        return durations.get(source.uri) ?? 48.6;
      case 'silent':
        return source.durationSec;
    }
  }

  const api: AriaAudioMock = {
    isMock: true,

    async getMicPermission() {
      return permission;
    },
    async requestMicPermission() {
      await new Promise((r) => setTimeout(r, 300));
      permission = 'granted';
      return 'granted';
    },
    async getInputs() {
      return inputs.map((i) => ({ ...i }));
    },
    async setPreferredInput(id) {
      if (!inputs.some((i) => i.id === id)) throw new Error(`Unknown input ${id}`);
      inputs = inputs.map((i) => ({ ...i, selected: i.id === id }));
      emitter.emit('routeChange', { inputs: await api.getInputs(), output: 'speaker', outputLatency: 0.005, reason: 'override' });
    },
    async getOutput() {
      return { output: 'speaker', outputLatency: 0.005 };
    },

    async startRecording(opts) {
      if (rec) throw new Error('Already recording');
      if (player.status === 'playing') api.pause();
      const beats = opts.countIn ? (opts.countIn.beats ?? 4) : 0;
      const beatSec = opts.countIn ? 60 / opts.countIn.bpm : 0;
      const beatTimers: ReturnType<typeof setTimeout>[] = [];
      for (let b = 0; b < beats; b++) {
        beatTimers.push(
          setTimeout(() => emitter.emit('countInBeat', { beat: b + 1, beats, audible: false }), b * beatSec * 1000),
        );
      }
      rec = {
        opts,
        startedAt: now(),
        countInEndSec: beats * beatSec,
        timer: setInterval(tickRecording, 1000 / LEVEL_HZ),
        beatTimers,
        warnState: null,
        badSince: null,
        goodSince: null,
        limitWarned: false,
        interrupted: false,
      };
      emitter.emit('recordingStatus', { state: 'recording', elapsedSec: 0 });
    },
    async stopRecording() {
      const r = finishRecording();
      if (!r) throw new Error('Not recording');
      return r;
    },
    async discardRecording() {
      finishRecording();
      lastResult = null;
    },

    async importAudio(src, projectDir) {
      await new Promise((r) => setTimeout(r, 400));
      const file = joinPath(projectDir, 'audio.m4a');
      const durationSec = 30 + (seeded(src)() * 90);
      durations.set(file, durationSec);
      return { file, durationSec };
    },

    async load(source) {
      stopTimer();
      sound?.remove();
      sound = null;
      // Remote previews make real sound through expo-audio; everything else stays a silent clock.
      if (source.kind === 'url') {
        const token = {};
        loadToken = token;
        const created = await createFallbackSound(source.url, (message) => {
          if (loadToken !== token) return; // a newer source replaced this one
          stopTimer();
          player.status = 'ended';
          emitClock();
          emitter.emit('playerError', { message });
        });
        sound = created;
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
      player.duration = durationFor(source);
      player.position = 0;
      player.status = 'paused';
      emitClock();
      return { durationSec: player.duration };
    },
    play() {
      if (player.status === 'idle') return;
      if (player.status === 'ended') player.position = 0;
      player.status = 'playing';
      player.lastTick = now();
      sound?.seek(player.position);
      sound?.play();
      stopTimer();
      player.timer = setInterval(tickPlayer, 1000 / CLOCK_HZ);
      emitClock();
    },
    pause() {
      if (player.status !== 'playing') return;
      sound?.pause();
      tickPlayer();
      stopTimer();
      player.status = 'paused';
      emitClock();
    },
    seek(sec) {
      player.position = Math.max(0, Math.min(sec, player.duration));
      player.lastTick = now();
      sound?.seek(player.position);
      if (player.status === 'ended') player.status = 'paused';
      emitClock();
    },
    setLoop(on) {
      player.loop = on;
      sound?.setLoop(on);
    },
    setRate(rate) {
      if (player.status === 'playing') tickPlayer();
      player.rate = Math.max(0.25, Math.min(2, rate));
      sound?.setRate(player.rate);
      emitClock();
    },
    unload() {
      stopTimer();
      sound?.remove();
      sound = null;
      Object.assign(player, { status: 'idle', duration: 0, position: 0 });
      emitClock();
    },

    async getPeaks(file, count) {
      const r = seeded(file);
      const out: number[] = [];
      for (let i = 0; i < count; i++) {
        const x = i / Math.max(1, count - 1);
        const phrase = Math.sin(Math.PI * ((x * 9) % 1)) ** 0.5;
        const v = 0.12 + 0.75 * phrase * (0.6 + 0.4 * r());
        out.push(Math.round(Math.min(1, v) * 1000) / 1000);
      }
      return out;
    },
    async recoverOrphanedRecordings() {
      return [];
    },

    addListener(event, cb) {
      return emitter.addListener(event, cb);
    },

    dispose() {
      if (rec) {
        clearInterval(rec.timer);
        rec.beatTimers.forEach(clearTimeout);
        rec = null;
      }
      stopTimer();
      emitter.removeAllListeners();
    },
    __forceInput(mode) {
      forced = mode;
    },
  };
  return api;
}
