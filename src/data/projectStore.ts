/**
 * Project folder I/O (ARCHITECTURE.md §5.1–5.2). The folder is the source of truth; SQLite is rebuilt from
 * manifests by `rebuildIndex`. Every JSON write is temp-file + rename, and bumps `manifest.updatedAt`.
 *
 *   Documents/Projects/<ULID>/
 *     manifest.json · audio.caf|audio.m4a · waveform.json · notes.raw.json · edits.json · cache/
 *
 * Uses the expo-file-system (SDK 57) File/Directory API. Native only — the web preview uses memoryRepo.
 */
import type { RawNotes } from '@modules/aria-transcriber';
import { Directory, File, Paths } from 'expo-file-system';

import {
  EMPTY_EDIT_LOG,
  ManifestError,
  manifestToProject,
  mergeProjectIntoManifest,
  newManifest,
  parseEditLog,
  parseManifest,
  serializeManifest,
  type EditLog,
  type ProjectManifest,
} from './projectManifest';
import type { Project } from './types';

export * from './projectManifest';

export const FILES = {
  manifest: 'manifest.json',
  audioCaf: 'audio.caf',
  audioM4a: 'audio.m4a',
  waveform: 'waveform.json',
  rawNotes: 'notes.raw.json',
  edits: 'edits.json',
  cache: 'cache',
} as const;

const TMP_SUFFIX = '.tmp';

// ---- locations ----

export function projectsRoot(): Directory {
  const dir = new Directory(Paths.document, 'Projects');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function projectDir(id: string): Directory {
  return new Directory(projectsRoot(), id);
}

/** file:// URI of the project folder (what native modules take as `projectDir`). */
export function projectDirUri(id: string): string {
  return projectDir(id).uri;
}

export function projectFile(id: string, name: string): File {
  return new File(projectDir(id), name);
}

/** The project's audio file: the ALAC m4a, or the CAF if a take hasn't been finalized. */
export function audioFile(id: string): File | null {
  const m4a = projectFile(id, FILES.audioM4a);
  if (m4a.exists) return m4a;
  const caf = projectFile(id, FILES.audioCaf);
  return caf.exists ? caf : null;
}

// ---- atomic JSON helpers ----

/** Writes `contents` to a sibling temp file then renames it over `file`. */
export function writeFileAtomic(file: File, contents: string): void {
  const parent = file.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  const tmp = new File(parent, file.name + TMP_SUFFIX);
  if (tmp.exists) tmp.delete();
  tmp.create();
  tmp.write(contents);
  // expo-file-system's overwrite = remove + move; readJson() falls back to the .tmp if we die in between.
  tmp.moveSync(file, { overwrite: true });
}

/** Reads a JSON text file, recovering a completed-but-unrenamed temp file after a crash. */
async function readText(file: File): Promise<string | null> {
  if (file.exists) return file.text();
  const tmp = new File(file.parentDirectory, file.name + TMP_SUFFIX);
  if (tmp.exists) {
    const text = await tmp.text();
    try {
      JSON.parse(text); // only adopt a complete temp file
      tmp.moveSync(file, { overwrite: true });
      return text;
    } catch {
      return null;
    }
  }
  return null;
}

// ---- manifest ----

export interface CreatedProject {
  id: string;
  /** file:// URI of the folder — pass to aria-audio.startRecording({ projectDir }) */
  dir: string;
  manifest: ProjectManifest;
}

export function createProject(kind: 'song' | 'idea', name: string, songId?: string): CreatedProject {
  const manifest = newManifest(kind, name, songId);
  const dir = projectDir(manifest.id);
  dir.create({ intermediates: true, idempotent: true });
  writeFileAtomic(new File(dir, FILES.manifest), serializeManifest(manifest));
  return { id: manifest.id, dir: dir.uri, manifest };
}

export async function readManifest(id: string): Promise<ProjectManifest | null> {
  const text = await readText(projectFile(id, FILES.manifest));
  return text == null ? null : parseManifest(text);
}

/** Atomic; sets `updatedAt` to now unless `keepUpdatedAt`. Returns what was written. */
export function writeManifest(manifest: ProjectManifest, opts: { keepUpdatedAt?: boolean } = {}): ProjectManifest {
  const m = opts.keepUpdatedAt ? manifest : { ...manifest, updatedAt: Date.now() };
  writeFileAtomic(projectFile(m.id, FILES.manifest), serializeManifest(m));
  return m;
}

/** Read-modify-write helper. Throws if the project has no manifest. */
export async function updateManifest(
  id: string,
  change: (m: ProjectManifest) => ProjectManifest,
): Promise<ProjectManifest> {
  const current = await readManifest(id);
  if (!current) throw new ManifestError(`project ${id} has no manifest`);
  return writeManifest(change(current));
}

/**
 * Makes the folder reflect a Project the app changed (rename, link to song, status…). Creates the folder
 * and manifest if the project was created in JS without `createProject`.
 */
export async function syncProjectToFolder(project: Project): Promise<ProjectManifest> {
  const existing = await readManifest(project.id).catch(() => null);
  const base =
    existing ??
    newManifest(project.kind, project.name, project.songId, { id: project.id, now: project.createdAt });
  if (!existing) projectDir(project.id).create({ intermediates: true, idempotent: true });
  return writeManifest(mergeProjectIntoManifest(base, project), { keepUpdatedAt: true });
}

// ---- notes / edits / waveform ----

export function writeRawNotes(id: string, raw: RawNotes): void {
  writeFileAtomic(projectFile(id, FILES.rawNotes), JSON.stringify(raw));
}

export async function readRawNotes(id: string): Promise<RawNotes | null> {
  const text = await readText(projectFile(id, FILES.rawNotes));
  return text == null ? null : (JSON.parse(text) as RawNotes);
}

export async function readEdits(id: string): Promise<EditLog> {
  const text = await readText(projectFile(id, FILES.edits));
  return text == null ? { ...EMPTY_EDIT_LOG, ops: [] } : parseEditLog(text);
}

/** Writes edits.json and mirrors `hasEdits` into the manifest (bumping updatedAt). */
export async function writeEdits(id: string, log: EditLog): Promise<void> {
  writeFileAtomic(projectFile(id, FILES.edits), JSON.stringify(log));
  const hasEdits = log.head > 0;
  await updateManifest(id, (m) => ({ ...m, hasEdits }));
}

export function writeWaveform(id: string, peaks: number[]): void {
  writeFileAtomic(projectFile(id, FILES.waveform), JSON.stringify(peaks));
}

export async function readWaveform(id: string): Promise<number[] | null> {
  const text = await readText(projectFile(id, FILES.waveform));
  return text == null ? null : (JSON.parse(text) as number[]);
}

/** Deletes derived files (cache/) — safe any time. */
export function clearCache(id: string): void {
  const cache = new Directory(projectDir(id), FILES.cache);
  if (cache.exists) cache.delete();
}

// ---- listing / deleting / index ----

export function listProjectDirs(): Directory[] {
  return projectsRoot()
    .list()
    .filter((e): e is Directory => e instanceof Directory && !e.name.startsWith('.'));
}

export function deleteProjectDir(id: string): void {
  const dir = projectDir(id);
  if (dir.exists) dir.delete();
}

export interface RebuildResult {
  projects: Project[];
  /** folders whose manifest was missing or unreadable (left untouched on disk) */
  skipped: { dir: string; reason: string }[];
}

/**
 * Scans Projects/*\/manifest.json and replaces the SQLite projects index (§5.1: "if the SQLite file is
 * deleted, the app rebuilds it"). Also useful after iCloud sync.
 */
export async function rebuildIndex(repo: { replaceProjects(projects: Project[]): Promise<void> }): Promise<RebuildResult> {
  const projects: Project[] = [];
  const skipped: RebuildResult['skipped'] = [];
  for (const dir of listProjectDirs()) {
    try {
      const m = await readManifest(dir.name);
      if (!m) {
        skipped.push({ dir: dir.uri, reason: 'no manifest.json' });
        continue;
      }
      if (m.id !== dir.name) {
        skipped.push({ dir: dir.uri, reason: `manifest id ${m.id} ≠ folder name` });
        continue;
      }
      projects.push(manifestToProject(m));
    } catch (e) {
      skipped.push({ dir: dir.uri, reason: e instanceof Error ? e.message : String(e) });
    }
  }
  projects.sort((a, b) => a.createdAt - b.createdAt);
  await repo.replaceProjects(projects);
  return { projects, skipped };
}
