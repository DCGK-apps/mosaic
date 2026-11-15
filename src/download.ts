/** Lets the browser save a file (download on a computer, "Save to Files"/share sheet on a phone). */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A file the user chose in the system "Save as" window. */
export interface SaveTarget {
  /** The name the user gave, with the extension. */
  name: string;
  write(blob: Blob): Promise<void>;
}

interface SaveFilePickerOptions {
  suggestedName: string;
  id: string;
  startIn?: string;
  types: { description: string; accept: Record<string, string[]> }[];
}
interface PickedFile {
  name: string;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}

/** True when the browser has a "Save as" window with a folder choice (Chrome and Edge on a computer). */
export function canChooseLocation(): boolean {
  return typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

/**
 * Opens the system "Save as" window: the user picks the folder (it starts in the
 * one used last time for this kind of file) and may change the name. Null when
 * the window was closed. Must be called from a click – the browser requires it.
 */
export async function chooseLocation(suggestedName: string, kind: 'image' | 'project', mime: string, ext: string, description: string): Promise<SaveTarget | null> {
  const pick = (window as unknown as { showSaveFilePicker: (o: SaveFilePickerOptions) => Promise<PickedFile> }).showSaveFilePicker;
  let file: PickedFile;
  try {
    file = await pick({
      suggestedName,
      id: kind === 'image' ? 'mosaic-image' : 'mosaic-project',
      startIn: kind === 'image' ? 'pictures' : 'documents',
      types: [{ description, accept: { [mime]: [ext] } }],
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
  return {
    name: file.name,
    async write(blob) {
      const w = await file.createWritable();
      await w.write(blob);
      await w.close();
    },
  };
}
