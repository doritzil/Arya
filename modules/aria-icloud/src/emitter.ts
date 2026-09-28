/**
 * Tiny typed event emitter used by the JS mock. The native module is itself an Expo `EventEmitter`
 * (SDK 52+), so both paths expose the same `addListener(event, cb) => { remove() }` shape.
 */
export interface Subscription {
  remove(): void;
}

export type ListenerMap<P> = { [K in keyof P]: (payload: P[K]) => void };

export class MockEmitter<P extends object> {
  private listeners = new Map<keyof P, Set<(payload: never) => void>>();

  addListener<K extends keyof P>(event: K, cb: (payload: P[K]) => void): Subscription {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb as (payload: never) => void);
    return {
      remove: () => {
        this.listeners.get(event)?.delete(cb as (payload: never) => void);
      },
    };
  }

  emit<K extends keyof P>(event: K, payload: P[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of [...set]) (cb as (p: P[K]) => void)(payload);
  }

  listenerCount(event: keyof P): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
