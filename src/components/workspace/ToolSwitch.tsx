import { ArrowLeftRight, Grid2x2, Move } from 'lucide-react';
import { cx } from '../cx';

/** What dragging on a photo does: move the crop, move the edges of the layout, or swap photos. */
export type Tool = 'crop' | 'edges' | 'swap';

const TOOLS: { tool: Tool; label: string; title: string; Icon: typeof Move }[] = [
  { tool: 'crop', label: 'Kadr', title: 'Przesuwanie i powiększanie zdjęcia w polu', Icon: Move },
  { tool: 'edges', label: 'Układ', title: 'Przesuwanie krawędzi: przeciągnij w dowolnym miejscu zdjęcia', Icon: Grid2x2 },
  { tool: 'swap', label: 'Zamiana', title: 'Zamiana miejscami: przeciągnij zdjęcie na inne', Icon: ArrowLeftRight },
];

/** Always on screen (also on a phone), so switching does not need the panel. */
export function ToolSwitch({ tool, onTool }: { tool: Tool; onTool: (t: Tool) => void }) {
  return (
    <div className="flex rounded-lg bg-white p-1 shadow-md ring-1 ring-slate-200" role="radiogroup" aria-label="Co robi przeciąganie zdjęcia">
      {TOOLS.map(({ tool: t, label, title, Icon }) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={tool === t}
          title={title}
          data-testid={`tool-${t}`}
          onClick={() => onTool(t)}
          className={cx(
            'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-bold transition-colors',
            tool === t ? 'bg-brand text-white shadow' : 'text-slate-600 hover:bg-blue-50 hover:text-brand',
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}
