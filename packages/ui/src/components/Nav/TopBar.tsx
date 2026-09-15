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
        'sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line-glass bg-surface-glass px-4 backdrop-blur-xl',
        className,
      )}
    >
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
