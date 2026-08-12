import type { ReactNode } from 'react';

export type StatusBadgeTone = 'neutral' | 'success' | 'warning';

export interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusBadgeTone;
}

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
