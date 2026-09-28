import { requireOptionalNativeModule, type EventEmitter } from 'expo';

import type { AriaTranscriberApi, AriaTranscriberEvents } from './AriaTranscriber.types';
import type { ListenerMap } from './emitter';
import { createAriaTranscriberMock } from './mock';

type NativeAriaTranscriber = Omit<AriaTranscriberApi, 'addListener'> &
  EventEmitter<ListenerMap<AriaTranscriberEvents>>;

const native = requireOptionalNativeModule<NativeAriaTranscriber>('AriaTranscriber');

export const isNative = native != null;

const AriaTranscriber: AriaTranscriberApi = native
  ? (native as unknown as AriaTranscriberApi)
  : createAriaTranscriberMock();

export default AriaTranscriber;
