/**
 * Undo/redo for any immutable value.
 * - `commit` records a finished change (one undo step).
 * - `preview` changes the present without recording – used while dragging;
 *   `end` then turns the whole gesture into a single undo step.
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** State before the gesture in progress, if any. */
  pending: T | null;
}

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], pending: null };
}

const push = <T>(past: T[], item: T) => [...past, item].slice(-HISTORY_LIMIT);

export function commit<T>(h: History<T>, next: T): History<T> {
  const base = end(h);
  if (next === base.present) return base;
  return { past: push(base.past, base.present), present: next, future: [], pending: null };
}

export function preview<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h;
  return { ...h, present: next, pending: h.pending ?? h.present };
}

export function end<T>(h: History<T>): History<T> {
  if (h.pending === null) return h;
  if (h.pending === h.present) return { ...h, pending: null };
  return { past: push(h.past, h.pending), present: h.present, future: [], pending: null };
}

export function undo<T>(h: History<T>): History<T> {
  const base = end(h);
  const prev = base.past[base.past.length - 1];
  if (prev === undefined) return base;
  return { past: base.past.slice(0, -1), present: prev, future: [base.present, ...base.future], pending: null };
}

export function redo<T>(h: History<T>): History<T> {
  const base = end(h);
  const [next, ...rest] = base.future;
  if (next === undefined) return base;
  return { past: push(base.past, base.present), present: next, future: rest, pending: null };
}

export const canUndo = (h: History<unknown>) => h.past.length > 0 || (h.pending !== null && h.pending !== h.present);
export const canRedo = (h: History<unknown>) => h.future.length > 0;
