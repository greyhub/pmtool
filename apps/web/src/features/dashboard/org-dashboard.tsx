'use client';

import { useTranslations } from 'next-intl';
import { useOrgDashboard } from '@pmtool/api-client';
import { PROJECT_STATUSES, TASK_STATUSES } from '@pmtool/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { StatCard } from './stat-card';
import { StatusBreakdown } from './status-breakdown';

export function OrgDashboard({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('dashboard.org');
  const tProjectStatus = useTranslations('projects.status');
  const tTaskStatus = useTranslations('tasks.status');
  const { data, isLoading } = useOrgDashboard(orgSlug);

  if (isLoading || !data) return null;

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
      <p className="text-sm text-ink-secondary">{t('subtitle')}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('totalProjects')} value={data.totalProjects} />
        <StatCard label={t('openRisks')} value={data.openRiskCount} />
        <StatCard label={t('overdueTasks')} value={data.overdueTasks.length} tone={data.overdueTasks.length > 0 ? 'danger' : undefined} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('projectBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown counts={data.projectCounts} statuses={PROJECT_STATUSES} labelFor={(s) => tProjectStatus(s)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('taskBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown counts={data.taskCounts} statuses={TASK_STATUSES} labelFor={(s) => tTaskStatus(s)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t('overdueTasks')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.overdueTasks.length === 0 ? (
            <p className="text-sm text-ink-secondary">{t('noOverdueTasks')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.overdueTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-ink-muted">{task.humanKey}</span>
                    <Link href={`/${orgSlug}/projects`} className="text-ink-primary hover:underline">
                      {task.title}
                    </Link>
                  </span>
                  <span className="text-ink-muted">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
