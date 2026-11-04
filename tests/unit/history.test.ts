import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, commit, createHistory, end, HISTORY_LIMIT, preview, redo, undo } from '../../src/core/history';

describe('history', () => {
  it('undoes and redoes committed changes', () => {
    let h = createHistory(0);
    h = commit(h, 1);
    h = commit(h, 2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(h.present).toBe(2);
    h = undo(undo(h));
    expect(h.present).toBe(0);
    expect(canUndo(h)).toBe(false);
    expect(undo(h)).toBe(h);
  });

  it('a new change clears the redo list; an unchanged value is not a step', () => {
    let h = commit(commit(createHistory('a'), 'b'), 'c');
    h = commit(undo(h), 'x');
    expect(canRedo(h)).toBe(false);
    expect(commit(h, 'x')).toBe(h);
  });

  it('a drag (many previews) is one undo step', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = preview(h, i);
    expect(canUndo(h)).toBe(true);
    h = end(h);
    expect(h.past).toEqual([0]);
    expect(undo(h).present).toBe(0);
  });

  it('undo in the middle of a drag goes back to before the drag', () => {
    const h = preview(preview(commit(createHistory(0), 1), 2), 3);
    expect(undo(h).present).toBe(1);
  });

  it('a drag that ends where it started leaves no step', () => {
    const start = createHistory({ v: 0 });
    const h = end(preview(preview(start, { v: 1 }), start.present));
    expect(h.past).toEqual([]);
  });

  it(`keeps the last ${HISTORY_LIMIT} steps`, () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = commit(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
  });
});
