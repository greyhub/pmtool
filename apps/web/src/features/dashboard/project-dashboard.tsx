'use client';

import { useTranslations } from 'next-intl';
import { useProjectDashboard } from '@pmtool/api-client';
import { TASK_STATUSES } from '@pmtool/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { ScopeMap } from './scope-map';
import { StatCard } from './stat-card';
import { StatusBreakdown } from './status-breakdown';

export function ProjectDashboard({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('dashboard.project');
  const tTaskStatus = useTranslations('tasks.status');
  const { data, isLoading } = useProjectDashboard(orgSlug, projectKey);

  if (isLoading || !data) return null;

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('completion')} value={data.completionPercent} />
        <StatCard label={t('totalTasks')} value={data.totalTasks} />
        <StatCard label={t('openRisks')} value={data.openRiskCount} />
        <StatCard label={t('openIssues')} value={data.openIssueCount} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('taskBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown counts={data.taskCounts} statuses={TASK_STATUSES} labelFor={(s) => tTaskStatus(s)} />
          </CardContent>
        </Card>

        <Card>
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
                      <Link
                        href={`/${orgSlug}/projects/${projectKey}/tasks/${task.id}`}
                        className="text-ink-primary hover:underline"
                      >
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

      <ScopeMap orgSlug={orgSlug} projectKey={projectKey} />
    </div>
  );
}
