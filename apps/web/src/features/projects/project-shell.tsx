'use client';

import { useTranslations } from 'next-intl';
import { useProject } from '@pmtool/api-client';
import { Badge } from '@pmtool/ui';
import { Link, usePathname } from '../../i18n/navigation';
import { BackHomeLinksWidget } from '../shell/back-home-links-widget';

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
    { href: `/${orgSlug}/projects/${projectKey}/dashboard`, label: tTabs('dashboard') },
    { href: `/${orgSlug}/projects/${projectKey}/tasks`, label: tTabs('tasks') },
    { href: `/${orgSlug}/projects/${projectKey}/board`, label: tTabs('board') },
    { href: `/${orgSlug}/projects/${projectKey}/gantt`, label: tTabs('gantt') },
    { href: `/${orgSlug}/projects/${projectKey}/milestones`, label: tTabs('milestones') },
    { href: `/${orgSlug}/projects/${projectKey}/deliverables`, label: tTabs('deliverables') },
    { href: `/${orgSlug}/projects/${projectKey}/risks`, label: tTabs('risks') },
    { href: `/${orgSlug}/projects/${projectKey}/charter`, label: tTabs('charter') },
    { href: `/${orgSlug}/projects/${projectKey}/stakeholders`, label: tTabs('stakeholders') },
    { href: `/${orgSlug}/projects/${projectKey}/documents`, label: tTabs('documents') },
    { href: `/${orgSlug}/projects/${projectKey}/artifacts`, label: tTabs('artifacts') },
    { href: `/${orgSlug}/projects/${projectKey}/settings`, label: tTabs('settings') },
  ];

  return (
    <div>
      <BackHomeLinksWidget homeHref={`/${orgSlug}/dashboard`} className="mb-3" />
      {project && (
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-ink-muted">{project.key}</span>
          <h1 className="text-lg font-semibold text-ink-primary">{project.name}</h1>
          <Badge variant={STATUS_VARIANT[project.status]}>{tStatus(project.status)}</Badge>
        </div>
      )}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                active
                  ? 'shrink-0 whitespace-nowrap border-b-2 border-action-primary px-3 py-2 text-sm font-medium text-ink-primary'
                  : 'shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-secondary hover:text-ink-primary'
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
