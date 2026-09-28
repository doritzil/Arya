import { requireOptionalNativeModule, type EventEmitter } from 'expo';

import type { AriaMusicKitApi, AriaMusicKitEvents } from './AriaMusicKit.types';
import type { ListenerMap } from './emitter';
import { createAriaMusicKitMock } from './mock';

type NativeAriaMusicKit = Omit<AriaMusicKitApi, 'addListener'> & EventEmitter<ListenerMap<AriaMusicKitEvents>>;

const native = requireOptionalNativeModule<NativeAriaMusicKit>('AriaMusicKit');

export const isNative = native != null;

const AriaMusicKit: AriaMusicKitApi = native ? (native as unknown as AriaMusicKitApi) : createAriaMusicKitMock();

export default AriaMusicKit;
