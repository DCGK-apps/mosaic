import { ImagePlus, Maximize } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useElementSize } from '../../hooks/useElementSize';
import type { Mosaic } from '../../hooks/useMosaic';
import { SheetView } from './SheetView';

interface Props {
  mosaic: Mosaic;
  swapMode: boolean;
  onFiles: (files: File[]) => void;
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

/** The area around the sheet; also accepts photos dropped from the computer. */
export function Workspace({ mosaic, swapMode, onFiles }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box);
  const [dropping, setDropping] = useState(false);
  const depth = useRef(0);

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
      <div ref={box} className="flex h-full w-full items-center justify-center">
        {mosaic.doc.photos.length === 0 ? (
          <div className="flex max-w-sm flex-col items-center justify-center text-center text-slate-400" data-testid="empty">
            <Maximize className="mb-4 h-16 w-16 text-slate-300" />
            <h2 className="mb-2 text-xl font-medium text-slate-700">Puste płótno</h2>
            <p className="text-sm">Wgraj zdjęcia za pomocą panelu bocznego albo przeciągnij je tutaj, aby utworzyć idealny kolaż.</p>
          </div>
        ) : (
          size.width > 0 && <SheetView mosaic={mosaic} width={size.width} height={size.height} swapMode={swapMode} />
        )}
      </div>
      {dropping && (
        <div className="pointer-events-none absolute inset-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-brand bg-blue-50/80 text-brand">
          <ImagePlus className="h-12 w-12" />
          <span className="font-bold">Upuść zdjęcia, aby dodać je do kolażu</span>
        </div>
      )}
    </div>
  );
}
