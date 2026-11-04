import { useState } from 'react';

interface Props {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  testId?: string;
}

/** Number input that applies the value on Enter or when leaving the field, so typing "4" on the way to "420" does nothing yet. */
export function NumberField({ label, value, onCommit, testId }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(',', '.'));
    if (draft.trim() !== '' && Number.isFinite(n)) onCommit(n);
    setDraft(null);
  };
  return (
    <label className="block flex-1">
      <span className="mb-1 block text-[10px] font-bold text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={draft ?? String(value)}
        data-testid={testId}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
        className="w-full rounded-md border border-slate-300 p-2 text-center text-sm font-medium focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}
