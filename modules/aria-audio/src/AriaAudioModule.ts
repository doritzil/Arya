import { requireOptionalNativeModule, type EventEmitter } from 'expo';

import type { AriaAudioApi, AriaAudioEvents } from './AriaAudio.types';
import type { ListenerMap } from './emitter';
import { createAriaAudioMock } from './mock';

type NativeAriaAudio = Omit<AriaAudioApi, 'addListener'> & EventEmitter<ListenerMap<AriaAudioEvents>>;

const native = requireOptionalNativeModule<NativeAriaAudio>('AriaAudio');

/** True when the Swift module is linked (dev/prod build). False → JS mock (web, Jest, Expo Go). */
export const isNative = native != null;

// The native module object is itself an EventEmitter, so its `addListener` already matches the API.
const AriaAudio: AriaAudioApi = native ? (native as unknown as AriaAudioApi) : createAriaAudioMock();

export default AriaAudio;
