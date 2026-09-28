/**
 * aria-icloud — optional iCloud Drive mirroring of project folders (ARCHITECTURE.md §8.3).
 * Skeleton: the Swift side has the structure (NSFileCoordinator, NSMetadataQuery) with TODOs.
 * Requires the `withICloud` plugin (entitlements) to be enabled in app.json.
 */
import AriaICloud, { isNative } from './src/AriaICloudModule';
import type { AriaICloudEvents, Subscription, SyncResult } from './src/AriaICloud.types';

export * from './src/AriaICloud.types';
export { isNative };

export const isAvailable = (): Promise<boolean> => AriaICloud.isAvailable();
export const setEnabled = (on: boolean, projectsDir: string): Promise<void> => AriaICloud.setEnabled(on, projectsDir);
export const syncNow = (projectsDir: string): Promise<SyncResult> => AriaICloud.syncNow(projectsDir);

export function addListener<K extends keyof AriaICloudEvents>(
  event: K,
  cb: (payload: AriaICloudEvents[K]) => void,
): Subscription {
  return AriaICloud.addListener(event, cb);
}
