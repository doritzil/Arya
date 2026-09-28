import {
  emptyLog,
  pushEdit,
  redo as redoLog,
  undo as undoLog,
  type EditLog,
  type EditOp,
  type ScoreSettings,
} from '@aria/score-engine';
import { useEffect } from 'react';
import { create } from 'zustand';

import { takeFiles } from '../record/takeFiles';

import { DEFAULT_SCORE_SETTINGS } from './useProjectScore';

/**
 * Per-take score settings ("How it's written", FR-9–11, FR-19) and the edit log (FR-18, FR-20).
 * Settings changes and edits share one undo history; only the current settings + op log are persisted
 * (manifest.scoreSettings, edits.json — ARCHITECTURE §5.4).
 */
type Entry = { settings: ScoreSettings; edits: EditLog; history: ScoreSettings[]; future: ScoreSettings[] };

interface NotesState {
  byProject: Record<string, Entry>;
  get(projectId: string): Entry;
  setSettings(projectId: string, patch: Partial<ScoreSettings>): void;
  edit(projectId: string, op: EditOp): void;
  undo(projectId: string): void;
  redo(projectId: string): void;
  /** Loads saved settings + edits from the take's folder once per session. */
  ensureLoaded(projectId: string): Promise<void>;
}

/** Shared default so selectors stay referentially stable for takes with no changes yet. */
export const FRESH_ENTRY: Entry = { settings: DEFAULT_SCORE_SETTINGS, edits: emptyLog(), history: [], future: [] };

// Undo pops the most recent change, whether it was a settings change or a note edit. We track the
// order with a tag stack per project.
const order: Record<string, ('s' | 'e')[]> = {};
const redoOrder: Record<string, ('s' | 'e')[]> = {};

const loaded = new Set<string>();
const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
/** Persist to manifest.scoreSettings + edits.json, debounced so dragging a stepper doesn't thrash disk. */
function persist(id: string) {
  clearTimeout(saveTimers[id]);
  saveTimers[id] = setTimeout(() => {
    const e = useNotes.getState().byProject[id];
    if (e) takeFiles.saveScoreState(id, e.settings, e.edits).catch((err) => console.warn('[notes] save failed', err));
  }, 400);
}

export const useNotes = create<NotesState>((set, get) => ({
  byProject: {},

  async ensureLoaded(id) {
    if (loaded.has(id)) return;
    loaded.add(id);
    const saved = await takeFiles.loadScoreState(id).catch(() => null);
    if (saved && !get().byProject[id]) {
      set({ byProject: { ...get().byProject, [id]: { ...FRESH_ENTRY, settings: saved.settings, edits: saved.edits } } });
    }
  },
  get: (id) => get().byProject[id] ?? FRESH_ENTRY,

  setSettings(id, patch) {
    const e = get().get(id);
    const settings = { ...e.settings, ...patch };
    (order[id] ??= []).push('s');
    redoOrder[id] = [];
    set({ byProject: { ...get().byProject, [id]: { ...e, settings, history: [...e.history, e.settings], future: [] } } });
    persist(id);
  },

  edit(id, op) {
    const e = get().get(id);
    (order[id] ??= []).push('e');
    redoOrder[id] = [];
    set({ byProject: { ...get().byProject, [id]: { ...e, edits: pushEdit(e.edits, op), future: [] } } });
    persist(id);
  },

  undo(id) {
    const e = get().get(id);
    const last = order[id]?.pop();
    if (!last) return;
    (redoOrder[id] ??= []).push(last);
    const next =
      last === 's'
        ? { ...e, settings: e.history.at(-1) ?? e.settings, history: e.history.slice(0, -1), future: [e.settings, ...e.future] }
        : { ...e, edits: undoLog(e.edits) };
    set({ byProject: { ...get().byProject, [id]: next } });
    persist(id);
  },

  redo(id) {
    const e = get().get(id);
    const last = redoOrder[id]?.pop();
    if (!last) return;
    (order[id] ??= []).push(last);
    const next =
      last === 's'
        ? { ...e, settings: e.future[0] ?? e.settings, history: [...e.history, e.settings], future: e.future.slice(1) }
        : { ...e, edits: redoLog(e.edits) };
    set({ byProject: { ...get().byProject, [id]: next } });
    persist(id);
  },
}));

export const canUndo = (id: string) => (order[id]?.length ?? 0) > 0;
export const canRedo = (id: string) => (redoOrder[id]?.length ?? 0) > 0;

/** Stable selector hook for one take. */
export function useNotesEntry(id: string) {
  useEffect(() => {
    useNotes.getState().ensureLoaded(id);
  }, [id]);
  return useNotes((s) => s.byProject[id] ?? FRESH_ENTRY);
}
