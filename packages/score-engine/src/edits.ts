// Edit log (FR-18–20): pure helpers plus application onto the quantized layer.

import type { EditLog, EditOp, QuantNote, RestItem } from './types';

export const emptyLog = (): EditLog => ({ ops: [], head: 0 });

/** Appends an op after the head, discarding any redo tail. */
export function pushEdit(log: EditLog, op: EditOp): EditLog {
  const ops = log.ops.slice(0, log.head);
  ops.push(op);
  return { ops, head: ops.length };
}

export function undo(log: EditLog): EditLog {
  return log.head > 0 ? { ops: log.ops, head: log.head - 1 } : log;
}

export function redo(log: EditLog): EditLog {
  return log.head < log.ops.length ? { ops: log.ops, head: log.head + 1 } : log;
}

export const canUndo = (log: EditLog): boolean => log.head > 0;
export const canRedo = (log: EditLog): boolean => log.head < log.ops.length;

export interface AppliedEdits {
  notes: QuantNote[];
  rests: RestItem[];
  /** Ops that referenced a note/rest that no longer exists (e.g. merged by re-quantization) or were invalid. */
  dropped: number;
}

/**
 * Applies ops[0..head) to quantized notes (by raw note id or added id; positions in quarter
 * beats). Never throws: an op that can't apply is skipped and counted.
 */
export function applyEditLog(notes: QuantNote[], log: EditLog | undefined): AppliedEdits {
  const byId = new Map<string, QuantNote>();
  for (const n of notes) byId.set(n.id, { ...n });
  const rests = new Map<string, RestItem>();
  let dropped = 0;
  if (log) {
    const head = Math.max(0, Math.min(log.head, log.ops.length));
    for (let i = 0; i < head; i++) {
      const op = log.ops[i]!;
      switch (op.t) {
        case 'pitch': {
          const n = byId.get(op.noteId);
          if (!n || !Number.isFinite(op.pitch)) dropped++;
          else n.pitch = Math.min(108, Math.max(21, Math.round(op.pitch)));
          break;
        }
        case 'length': {
          const n = byId.get(op.noteId) ?? rests.get(op.noteId);
          if (!n || !(op.beats > 0)) dropped++;
          else n.beats = op.beats;
          break;
        }
        case 'delete': {
          if (byId.has(op.noteId)) byId.delete(op.noteId);
          else if (rests.has(op.noteId)) rests.delete(op.noteId);
          else dropped++;
          break;
        }
        case 'addNote': {
          if (byId.has(op.id) || !(op.beats > 0) || !(op.beat >= 0)) dropped++;
          else
            byId.set(op.id, {
              id: op.id,
              pitch: Math.min(108, Math.max(21, Math.round(op.pitch))),
              beat: op.beat,
              beats: op.beats,
              velocity: 80,
              staff: op.staff,
              added: true,
            });
          break;
        }
        case 'addRest': {
          if (rests.has(op.id) || !(op.beats > 0) || !(op.beat >= 0)) dropped++;
          else rests.set(op.id, { id: op.id, beat: op.beat, beats: op.beats, staff: op.staff });
          break;
        }
      }
    }
  }
  const out = [...byId.values()].sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  return { notes: out, rests: [...rests.values()].sort((a, b) => a.beat - b.beat), dropped };
}
