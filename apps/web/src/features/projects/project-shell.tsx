'use client';

import { useTranslations } from 'next-intl';
import { useProject } from '@pmtool/api-client';
import { Badge } from '@pmtool/ui';
import { Link, usePathname } from '../../i18n/navigation';
import { BackHomeLinksWidget } from '../shell/back-home-links-widget';
import { usePermissions } from './use-permissions';

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
  const { role } = usePermissions(orgSlug, projectKey);

  const tGroups = useTranslations('projects.groups');
  const base = `/${orgSlug}/projects/${projectKey}`;
  // Six top-level groups instead of fourteen tabs; every view keeps its own URL and is one click away in the sub-navigation.
  const groups: { key: string; label: string; items: { href: string; label: string }[] }[] = [
    {
      key: 'overview',
      label: tGroups('overview'),
      items: [
        { href: `${base}/dashboard`, label: tGroups('overview') },
        { href: `${base}/reports`, label: tGroups('report') },
      ],
    },
    {
      key: 'work',
      label: tGroups('work'),
      items: [
        { href: `${base}/tasks`, label: tGroups('list') },
        { href: `${base}/board`, label: tTabs('board') },
        ...(project?.sprintsEnabled ? [{ href: `${base}/sprints`, label: tTabs('sprints') }] : []),
      ],
    },
    {
      key: 'schedule',
      label: tGroups('schedule'),
      items: [
        { href: `${base}/gantt`, label: tTabs('gantt') },
        { href: `${base}/milestones`, label: tTabs('milestones') },
      ],
    },
    {
      key: 'plan',
      label: tGroups('plan'),
      items: [
        { href: `${base}/scope`, label: tTabs('scope') },
        { href: `${base}/wbs`, label: tTabs('wbs') },
        { href: `${base}/charter`, label: tTabs('charter') },
        { href: `${base}/deliverables`, label: tTabs('deliverables') },
      ],
    },
    {
      key: 'governance',
      label: tGroups('governance'),
      items: [
        { href: `${base}/risks`, label: tTabs('risks') },
        { href: `${base}/stakeholders`, label: tTabs('stakeholders') },
        { href: `${base}/documents`, label: tTabs('documents') },
        { href: `${base}/artifacts`, label: tTabs('artifacts') },
        { href: `${base}/history`, label: tGroups('history') },
      ],
    },
    {
      key: 'settings',
      label: tTabs('settings'),
      items: [{ href: `${base}/settings`, label: tTabs('settings') }],
    },
  ];
  const activeGroup = groups.find((g) => g.items.some((i) => pathname.startsWith(i.href)));

  return (
    <div>
      <BackHomeLinksWidget homeHref={`/${orgSlug}/dashboard`} className="mb-3 print:hidden" />
      {project && (
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-ink-muted">{project.key}</span>
          <h1 className="text-lg font-semibold text-ink-primary">{project.name}</h1>
          <Badge variant={STATUS_VARIANT[project.status]}>{tStatus(project.status)}</Badge>
        </div>
      )}
      <nav
        aria-label={tGroups('aria')}
        className="mb-4 flex gap-1 overflow-x-auto border-b border-line print:hidden"
      >
        {groups.map((g) => {
          const active = g === activeGroup;
          return (
            <Link
              key={g.key}
              href={g.items[0]!.href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'shrink-0 whitespace-nowrap border-b-2 border-action-primary px-3 py-2 text-sm font-medium text-ink-primary'
                  : 'shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-secondary hover:text-ink-primary'
              }
            >
              {g.label}
            </Link>
          );
        })}
      </nav>
      {activeGroup && activeGroup.items.length > 1 && (
        <div
          className="mb-6 flex gap-1 overflow-x-auto print:hidden"
          role="group"
          aria-label={activeGroup.label}
        >
          {activeGroup.items.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'glass-field shrink-0 whitespace-nowrap rounded-full border border-line-glass px-3 py-1 text-sm font-medium text-ink-primary'
                    : 'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
      {activeGroup && activeGroup.items.length === 1 && <div className="mb-2" />}
      {role === 'VIEWER' && (
        <p role="note" className="mb-4 rounded-md bg-info-bg px-3 py-2 text-sm text-info">
          {tTabs('viewerNotice')}
        </p>
      )}
      {children}
    </div>
  );
}
