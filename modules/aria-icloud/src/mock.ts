/** JS stand-in: iCloud is unavailable, so Settings shows the toggle disabled with an explanation. */
import type { AriaICloudApi, AriaICloudEvents } from './AriaICloud.types';
import { MockEmitter } from './emitter';

export function createAriaICloudMock(): AriaICloudApi & { readonly isMock: true } {
  const emitter = new MockEmitter<AriaICloudEvents>();
  return {
    isMock: true,
    async isAvailable() {
      return false;
    },
    async setEnabled() {
      emitter.emit('syncStatus', { state: 'unavailable', message: 'iCloud is not available in this build' });
    },
    async syncNow() {
      return { uploaded: 0, downloaded: 0, conflicts: 0 };
    },
    addListener(event, cb) {
      return emitter.addListener(event, cb);
    },
  };
}
