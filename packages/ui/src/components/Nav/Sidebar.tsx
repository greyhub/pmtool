import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SidebarItem {
  href: string;
  label: string;
  icon?: ReactNode;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeHref: string;
  /** Defaults to a native `<a>`; pass the host router's Link (e.g. next-intl's locale-aware Link) to integrate client-side navigation. */
  LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
  className?: string;
}

export function Sidebar({ items, activeHref, LinkComponent, className }: SidebarProps) {
  const LinkTag = LinkComponent ?? (({ href, className: c, children }) => (
    <a href={href} className={c}>
      {children}
    </a>
  ));

  return (
    <nav aria-label="Điều hướng chính" className={cn('flex flex-col gap-1', className)}>
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <LinkTag
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-action-primary/15 text-ink-primary'
                : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary',
            )}
          >
            {item.icon && (
              <span aria-hidden="true" className={cn(active ? 'text-warning' : 'text-ink-muted')}>
                {item.icon}
              </span>
            )}
            {item.label}
          </LinkTag>
        );
      })}
    </nav>
  );
}
