import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DEFAULT_CROP } from '../core/crop';
import { docReducer, emptyDoc, type DocAction } from '../core/doc';
import { canRedo, canUndo, commit, createHistory, end, preview, redo, undo, type History } from '../core/history';
import { randomSeed } from '../core/random';
import type { Doc, Photo } from '../core/types';
import { isImageFile, readImage, type ImageEntry } from '../images';
import { download } from '../download';
import { MosaicDb } from '../storage/db';
import { ProjectError, projectFileName, readProject, writeProject } from '../storage/project';
import { restoreDoc, toSaved } from '../storage/serialize';

type AppAction =
  | { type: 'doc'; action: DocAction; transient?: boolean }
  | { type: 'endGesture' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; doc: Doc }
  /** An opened project – one undoable step, so Ctrl+Z brings the previous work back. */
  | { type: 'open'; doc: Doc };

function appReducer(h: History<Doc>, a: AppAction): History<Doc> {
  switch (a.type) {
    case 'doc': {
      const next = docReducer(h.present, a.action);
      return a.transient ? preview(h, next) : commit(h, next);
    }
    case 'endGesture':
      return end(h);
    case 'undo':
      return undo(h);
    case 'redo':
      return redo(h);
    case 'load':
      return createHistory(a.doc);
    case 'open':
      return commit(h, a.doc);
  }
}

/** Actions that need a random seed get one here, so the reducer stays pure. */
type SeedFree<A> = A extends { seed: number } ? Omit<A, 'seed'> : A;
export type MosaicAction = SeedFree<DocAction>;

const SAVE_DELAY_MS = 400;

let nextId = 0;
const newPhotoId = () => `p${Date.now().toString(36)}${(nextId++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The whole app state: the document with undo/redo, the image files, and
 * autosaving both to IndexedDB.
 */
export function useMosaic() {
  const [history, dispatch] = useReducer(appReducer, undefined, () => createHistory(emptyDoc()));
  const doc = history.present;
  const images = useRef(new Map<string, ImageEntry>());
  const db = useRef<MosaicDb | null>(null);
  const stored = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const docRef = useRef(doc);
  useLayoutEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const act = useCallback((action: MosaicAction, opts: { transient?: boolean } = {}) => {
    dispatch({ type: 'doc', action: { ...action, seed: randomSeed() } as DocAction, transient: opts.transient });
  }, []);
  const endGesture = useCallback(() => dispatch({ type: 'endGesture' }), []);
  const undoFn = useCallback(() => dispatch({ type: 'undo' }), []);
  const redoFn = useCallback(() => dispatch({ type: 'redo' }), []);

  const addFiles = useCallback(
    async (files: Iterable<File>): Promise<number> => {
      const photos: Photo[] = [];
      for (const file of files) {
        if (!isImageFile(file)) continue;
        try {
          const { url, width, height } = await readImage(file);
          const id = newPhotoId();
          images.current.set(id, { blob: file, url });
          photos.push({ id, name: file.name, width, height, crop: { ...DEFAULT_CROP } });
        } catch {
          /* not a decodable image – skipped */
        }
      }
      if (photos.length) act({ type: 'addPhotos', photos });
      return photos.length;
    },
    [act],
  );

  /** Saves an editable project file (.mosaic) with the document and the original photos. */
  const saveProject = useCallback(() => {
    const current = docRef.current;
    download(writeProject(current, (id) => images.current.get(id)?.blob), projectFileName(current));
  }, []);

  /** Opens a project file in place of the current work. Throws ProjectError with a message for the user. */
  const openProject = useCallback(async (file: Blob): Promise<void> => {
    const { saved, images: blobs } = await readProject(file);
    const opened = new Map<string, ImageEntry>();
    for (const [id, blob] of blobs) {
      const known = images.current.get(id);
      if (known && known.blob.size === blob.size) {
        opened.set(id, known);
        continue;
      }
      try {
        const { url } = await readImage(blob);
        opened.set(id, { blob, url });
      } catch {
        /* a damaged photo – left out, restoreDoc closes its gap */
      }
    }
    const restored = restoreDoc(saved, (id) => opened.has(id));
    if (!restored) {
      for (const [id, entry] of opened) if (images.current.get(id) !== entry) URL.revokeObjectURL(entry.url);
      throw new ProjectError('Ten plik projektu pochodzi z nowszej wersji programu albo jest uszkodzony');
    }
    for (const [id, entry] of opened) {
      const old = images.current.get(id);
      if (old === entry) continue;
      // Same id, different file (practically impossible – ids are random): the opened one wins.
      if (old) {
        URL.revokeObjectURL(old.url);
        stored.current.delete(id);
      }
      images.current.set(id, entry);
    }
    dispatch({ type: 'open', doc: restored });
  }, []);

  const urlOf = useCallback((photoId: string) => images.current.get(photoId)?.url, []);

  // Restore the saved work once.
  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      try {
        const store = await MosaicDb.open();
        if (run.cancelled) return store.close();
        db.current = store;
        const [saved, blobs] = await Promise.all([store.loadDoc(), store.loadImages()]);
        const restored = saved ? restoreDoc(saved, (id) => blobs.has(id)) : null;
        const used = new Set([...(restored?.photos ?? []), ...(restored?.magazine ?? [])].map((p) => p.id));
        for (const [id, blob] of blobs) {
          if (!used.has(id)) continue;
          images.current.set(id, { blob, url: URL.createObjectURL(blob) });
          stored.current.add(id);
        }
        await store.deleteImages([...blobs.keys()].filter((id) => !used.has(id)));
        if (restored && !run.cancelled) dispatch({ type: 'load', doc: restored });
      } catch {
        /* no IndexedDB (private mode…) – the app works, just without autosave */
      } finally {
        if (!run.cancelled) setReady(true);
      }
    })();
    return () => {
      run.cancelled = true;
    };
  }, []);

  const save = useCallback(async (current: Doc) => {
    const store = db.current;
    if (!store) return;
    const ids = new Set([...current.photos, ...current.magazine].map((p) => p.id));
    for (const id of ids) {
      const entry = images.current.get(id);
      if (entry && !stored.current.has(id)) {
        await store.putImage(id, entry.blob);
        stored.current.add(id);
      }
    }
    await store.saveDoc(toSaved(current));
    const extra = [...stored.current].filter((id) => !ids.has(id));
    if (extra.length) {
      await store.deleteImages(extra);
      for (const id of extra) stored.current.delete(id);
    }
  }, []);

  // Autosave, debounced; skipped while a drag is in progress.
  const saving = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!ready || history.pending) return;
    const t = setTimeout(() => {
      saving.current = saving.current.then(() => save(doc)).catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [doc, ready, history.pending, save]);

  const flush = useCallback(async () => {
    saving.current = saving.current.then(() => save(docRef.current)).catch(() => undefined);
    await saving.current;
  }, [save]);

  // Hooks for the end-to-end tests.
  useEffect(() => {
    (window as unknown as { __mosaic?: unknown }).__mosaic = { doc: () => docRef.current, flush };
  }, [flush]);

  return useMemo(
    () => ({
      doc,
      ready,
      act,
      endGesture,
      undo: undoFn,
      redo: redoFn,
      canUndo: canUndo(history),
      canRedo: canRedo(history),
      addFiles,
      saveProject,
      openProject,
      urlOf,
    }),
    [doc, ready, act, endGesture, undoFn, redoFn, history, addFiles, saveProject, openProject, urlOf],
  );
}

export type Mosaic = ReturnType<typeof useMosaic>;
