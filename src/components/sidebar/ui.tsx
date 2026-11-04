import type { ReactNode } from 'react';

export function SectionTitle({ children, className = 'mb-2' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-xs font-bold uppercase text-slate-400 ${className}`}>{children}</h3>;
}

export const Separator = () => <div className="h-px bg-slate-200" />;
