/** Public types for `aria-icloud` (ARCHITECTURE.md §8.3, FR-23, optional / Phase 4b). */
import type { Subscription } from './emitter';

export type { Subscription };

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: number;
}

export interface SyncStatusEvent {
  state: 'idle' | 'syncing' | 'error' | 'unavailable';
  message?: string;
}

export interface AriaICloudEvents {
  syncStatus: SyncStatusEvent;
}

export interface AriaICloudApi {
  /** iCloud account signed in and the ubiquity container reachable. */
  isAvailable(): Promise<boolean>;
  /** Off by default (prefs.iCloudEnabled). Enabling starts watching the container. */
  setEnabled(on: boolean, projectsDir: string): Promise<void>;
  /** Mirror Projects/* both ways now. After downloads, the caller rebuilds the SQLite index. */
  syncNow(projectsDir: string): Promise<SyncResult>;
  addListener<K extends keyof AriaICloudEvents>(event: K, cb: (payload: AriaICloudEvents[K]) => void): Subscription;
}
