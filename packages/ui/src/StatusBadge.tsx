import type { ReactNode } from 'react';

export type StatusBadgeTone = 'neutral' | 'success' | 'warning';

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusBadgeTone;
}

const toneClassName = {
  neutral: 'border-slate-300 bg-slate-50 text-slate-700',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
} satisfies Record<StatusBadgeTone, string>;

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-md border px-3 text-sm font-medium ${toneClassName[tone]}`}
    >
      {children}
    </span>
  );
}
