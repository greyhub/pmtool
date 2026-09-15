'use client';

import { useTranslations } from 'next-intl';
import { useProject } from '@pmtool/api-client';
import { Badge } from '@pmtool/ui';
import { Link, usePathname } from '../../i18n/navigation';

const STATUS_VARIANT = {
  PLANNING: 'neutral',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'info',
  ARCHIVED: 'neutral',
} as const;

export function ProjectShell({
  orgSlug,
  projectKey,
  children,
}: {
  orgSlug: string;
  projectKey: string;
  children: React.ReactNode;
}) {
  const { data: project } = useProject(orgSlug, projectKey);
  const tStatus = useTranslations('projects.status');
  const tTabs = useTranslations('projects.tabs');
  const pathname = usePathname();

  const tabs = [
    { href: `/${orgSlug}/projects/${projectKey}/tasks`, label: tTabs('tasks') },
    { href: `/${orgSlug}/projects/${projectKey}/board`, label: tTabs('board') },
  ];

  return (
    <div>
      {project && (
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-ink-muted">{project.key}</span>
          <h1 className="text-lg font-semibold text-ink-primary">{project.name}</h1>
          <Badge variant={STATUS_VARIANT[project.status]}>{tStatus(project.status)}</Badge>
        </div>
      )}
      <div className="mb-6 flex gap-1 border-b border-line">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                active
                  ? 'border-b-2 border-action-primary px-3 py-2 text-sm font-medium text-ink-primary'
                  : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-secondary hover:text-ink-primary'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
