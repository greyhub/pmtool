import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface BackHomeLinksProps {
  /** Called when "Back" is activated. Host decides the behavior (e.g. browser history back). */
  onBack: () => void;
  backLabel: string;
  homeHref: string;
  homeLabel: string;
  /** Defaults to a native `<a>`; pass the host router's Link to integrate client-side navigation. */
  LinkComponent?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
  className?: string;
}

export function BackHomeLinks({
  onBack,
  backLabel,
  homeHref,
  homeLabel,
  LinkComponent,
  className,
}: BackHomeLinksProps) {
  const LinkTag =
    LinkComponent ??
    (({ href, className: c, children }: { href: string; className?: string; children: ReactNode }) => (
      <a href={href} className={c}>
        {children}
      </a>
    ));

  return (
    <div className={cn('flex items-center gap-4 text-sm', className)}>
      <button type="button" onClick={onBack} className="text-ink-secondary hover:underline">
        ← {backLabel}
      </button>
      <LinkTag href={homeHref} className="text-ink-secondary hover:underline">
        {homeLabel}
      </LinkTag>
    </div>
  );
}
