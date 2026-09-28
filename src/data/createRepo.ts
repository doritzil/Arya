import { createMemoryRepo } from './memoryRepo';
import type { LibraryRepo } from './repo';

// Resolved by TypeScript and Jest. Metro picks createRepo.native.ts / createRepo.web.ts at bundle time.
export function createRepo(): LibraryRepo {
  return createMemoryRepo();
}
