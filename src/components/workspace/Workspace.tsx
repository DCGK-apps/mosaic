import { ImagePlus, Maximize, Type } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { newTextBox, type TextBox } from '../../core/text';
import { useElementSize } from '../../hooks/useElementSize';
import type { Mosaic } from '../../hooks/useMosaic';
import { SheetView } from './SheetView';
import { TextToolbar } from './TextToolbar';

interface Props {
  mosaic: Mosaic;
  swapMode: boolean;
  onFiles: (files: File[]) => void;
}

const newTextId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

/** The area around the sheet; also accepts photos dropped from the computer. */
export function Workspace({ mosaic, swapMode, onFiles }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box);
  const [dropping, setDropping] = useState(false);
  const depth = useRef(0);
  const { doc, act, endGesture } = mosaic;
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const selected = doc.texts?.find((t) => t.id === selectedText);
  const hasPhotos = doc.photos.length > 0;

  const addText = () => {
    const texts = doc.texts ?? [];
    const like = texts.find((t) => t.id === selectedText) ?? texts[texts.length - 1];
    const text = newTextBox(newTextId(), doc.sheet, like);
    act({ type: 'addText', box: text });
    setSelectedText(text.id);
    setFocusKey((k) => k + 1);
  };
  /** A tap selects a caption without opening the keyboard; editing asks for the focus. */
  const selectText = useCallback(
    (id: string | null) => {
      if (id !== selectedText) setFocusKey(0);
      setSelectedText(id);
    },
    [selectedText],
  );
  const editText = useCallback((id: string) => {
    setSelectedText(id);
    setFocusKey((k) => k + 1);
  }, []);
  const done = useCallback(() => {
    endGesture();
    setSelectedText(null);
  }, [endGesture]);
  const removeText = useCallback(() => {
    if (!selectedText) return;
    endGesture();
    act({ type: 'deleteText', id: selectedText });
    setSelectedText(null);
  }, [act, endGesture, selectedText]);

  // Delete / Backspace removes the selected caption, Escape lets it go (not while typing).
  useEffect(() => {
    if (!selectedText) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeText();
      } else if (e.key === 'Escape') done();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedText, removeText, done]);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-slate-100 p-4 md:p-8"
      data-testid="workspace"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setDropping(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDropping(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDropping(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div
        ref={box}
        className="flex min-h-0 w-full flex-1 items-center justify-center"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setSelectedText(null);
        }}
      >
        {!hasPhotos ? (
          <div className="flex max-w-sm flex-col items-center justify-center text-center text-slate-400" data-testid="empty">
            <Maximize className="mb-4 h-16 w-16 text-slate-300" />
            <h2 className="mb-2 text-xl font-medium text-slate-700">Puste płótno</h2>
            <p className="text-sm">Wgraj zdjęcia za pomocą panelu bocznego albo przeciągnij je tutaj, aby utworzyć idealny kolaż.</p>
          </div>
        ) : (
          size.width > 0 && (
            <SheetView
              mosaic={mosaic}
              width={size.width}
              height={size.height}
              swapMode={swapMode}
              selectedText={selected ? selected.id : null}
              onSelectText={selectText}
              onEditText={editText}
            />
          )
        )}
      </div>
      {hasPhotos && selected && (
        <TextToolbar
          key={selected.id}
          box={selected}
          onChange={(patch: Partial<Omit<TextBox, 'id'>>, transient?: boolean) => act({ type: 'updateText', id: selected.id, patch }, { transient })}
          onEnd={endGesture}
          onDelete={removeText}
          onDone={done}
          focusKey={focusKey}
        />
      )}
      {hasPhotos && (
        <button
          type="button"
          onClick={addText}
          className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-bold text-brand shadow-md ring-1 ring-slate-200 hover:bg-blue-50"
          title="Dodaj napis na kolażu"
          data-testid="text-add"
        >
          <Type className="h-4 w-4" /> Dodaj napis
        </button>
      )}
      {dropping && (
        <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-brand bg-blue-50/80 text-brand">
          <ImagePlus className="h-12 w-12" />
          <span className="font-bold">Upuść zdjęcia, aby dodać je do kolażu</span>
        </div>
      )}
    </div>
  );
}
