'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

export interface OrgOption {
  slug: string;
  name: string;
}

export interface OrgSwitcherProps {
  current: OrgOption;
  options: OrgOption[];
  onSelect: (slug: string) => void;
  onCreateNew?: () => void;
  createNewLabel?: string;
  className?: string;
}

/** Presentational dropdown — the host app supplies the org list and the navigation side effect. */
export function OrgSwitcher({ current, options, onSelect, onCreateNew, createNewLabel, className }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-ink-primary hover:bg-surface-subtle"
      >
        <span>{current.name}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-line-glass bg-surface-glass-strong py-1 shadow-xl shadow-black/10 backdrop-blur-2xl"
        >
          {options.map((org) => (
            <button
              key={org.slug}
              role="menuitemradio"
              aria-checked={org.slug === current.slug}
              type="button"
              onClick={() => {
                onSelect(org.slug);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center px-3 py-2 text-left text-sm hover:bg-surface-subtle',
                org.slug === current.slug ? 'font-medium text-ink-primary' : 'text-ink-secondary',
              )}
            >
              {org.name}
            </button>
          ))}
          {onCreateNew && (
            <>
              <div className="my-1 border-t border-line-glass" />
              <button
                type="button"
                onClick={() => {
                  onCreateNew();
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-ink-primary hover:bg-surface-subtle"
              >
                {createNewLabel ?? '+ Tạo tổ chức mới'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
