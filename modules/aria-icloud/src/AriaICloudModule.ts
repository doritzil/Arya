import { requireOptionalNativeModule, type EventEmitter } from 'expo';

import type { AriaICloudApi, AriaICloudEvents } from './AriaICloud.types';
import type { ListenerMap } from './emitter';
import { createAriaICloudMock } from './mock';

type NativeAriaICloud = Omit<AriaICloudApi, 'addListener'> & EventEmitter<ListenerMap<AriaICloudEvents>>;

const native = requireOptionalNativeModule<NativeAriaICloud>('AriaICloud');

export const isNative = native != null;

const AriaICloud: AriaICloudApi = native ? (native as unknown as AriaICloudApi) : createAriaICloudMock();

export default AriaICloud;
