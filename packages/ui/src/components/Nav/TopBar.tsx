import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TopBarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function TopBar({ left, right, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between gap-4 border-b border-line bg-surface px-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
