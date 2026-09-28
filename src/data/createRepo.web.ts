import { createMemoryRepo } from './memoryRepo';
import type { LibraryRepo } from './repo';

/** Web preview: in-memory. `?demo` in the URL (or EXPO_PUBLIC_DEMO=1) pre-fills the designs' sample data. */
export function createRepo(): LibraryRepo {
  const demo =
    process.env.EXPO_PUBLIC_DEMO === '1' ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo'));
  return createMemoryRepo({ demo });
}
