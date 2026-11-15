/**
 * IndexedDB storage for the autosaved work: the document (JSON) and the
 * original image files (Blobs), so everything comes back after a reload.
 */
const DB_NAME = 'mosaic';
const DB_VERSION = 2;
const STATE = 'state';
const IMAGES = 'images';
/** Small previews of the photos of an automatic series (since version 2). */
const THUMBS = 'thumbs';
const DOC_KEY = 'current';
const BATCH_KEY = 'batch';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export class MosaicDb {
  private constructor(private readonly db: IDBDatabase) {}

  static open(name = DB_NAME, factory: IDBFactory = indexedDB): Promise<MosaicDb> {
    return new Promise((resolve, reject) => {
      const req = factory.open(name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STATE)) db.createObjectStore(STATE);
        if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
        if (!db.objectStoreNames.contains(THUMBS)) db.createObjectStore(THUMBS);
      };
      req.onsuccess = () => resolve(new MosaicDb(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  async loadDoc(): Promise<unknown> {
    return request(this.db.transaction(STATE).objectStore(STATE).get(DOC_KEY));
  }

  async saveDoc(saved: unknown): Promise<void> {
    const tx = this.db.transaction(STATE, 'readwrite');
    tx.objectStore(STATE).put(saved, DOC_KEY);
    await done(tx);
  }

  /** The collages of the automatic series. */
  async loadBatch(): Promise<unknown> {
    return request(this.db.transaction(STATE).objectStore(STATE).get(BATCH_KEY));
  }

  async saveBatch(saved: unknown): Promise<void> {
    const tx = this.db.transaction(STATE, 'readwrite');
    tx.objectStore(STATE).put(saved, BATCH_KEY);
    await done(tx);
  }

  putImage(id: string, blob: Blob): Promise<void> {
    return this.put(IMAGES, id, blob);
  }

  loadImages(): Promise<Map<string, Blob>> {
    return this.loadAll(IMAGES);
  }

  deleteImages(ids: Iterable<string>): Promise<void> {
    return this.delete(IMAGES, ids);
  }

  putThumb(id: string, blob: Blob): Promise<void> {
    return this.put(THUMBS, id, blob);
  }

  loadThumbs(): Promise<Map<string, Blob>> {
    return this.loadAll(THUMBS);
  }

  deleteThumbs(ids: Iterable<string>): Promise<void> {
    return this.delete(THUMBS, ids);
  }

  private async put(storeName: string, id: string, blob: Blob): Promise<void> {
    const tx = this.db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(blob, id);
    await done(tx);
  }

  private async loadAll(storeName: string): Promise<Map<string, Blob>> {
    const store = this.db.transaction(storeName).objectStore(storeName);
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    return new Map(keys.map((k, i) => [String(k), values[i] as Blob]));
  }

  private async delete(storeName: string, ids: Iterable<string>): Promise<void> {
    const tx = this.db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const id of ids) store.delete(id);
    await done(tx);
  }

  close(): void {
    this.db.close();
  }
}
