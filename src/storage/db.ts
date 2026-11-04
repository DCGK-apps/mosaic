/**
 * IndexedDB storage for the autosaved work: the document (JSON) and the
 * original image files (Blobs), so everything comes back after a reload.
 */
const DB_NAME = 'mosaic';
const DB_VERSION = 1;
const STATE = 'state';
const IMAGES = 'images';
const DOC_KEY = 'current';

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

  async putImage(id: string, blob: Blob): Promise<void> {
    const tx = this.db.transaction(IMAGES, 'readwrite');
    tx.objectStore(IMAGES).put(blob, id);
    await done(tx);
  }

  async loadImages(): Promise<Map<string, Blob>> {
    const store = this.db.transaction(IMAGES).objectStore(IMAGES);
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
    return new Map(keys.map((k, i) => [String(k), values[i] as Blob]));
  }

  async deleteImages(ids: Iterable<string>): Promise<void> {
    const tx = this.db.transaction(IMAGES, 'readwrite');
    const store = tx.objectStore(IMAGES);
    for (const id of ids) store.delete(id);
    await done(tx);
  }

  close(): void {
    this.db.close();
  }
}
