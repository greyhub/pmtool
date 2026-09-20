'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMilestones } from '@pmtool/api-client';
import { Avatar, Badge, Button, Card } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { formatDate } from '../../lib/date-input';
import { DeliverableFormModal } from '../deliverables/deliverable-form-modal';
import { TaskStatusBadge } from '../tasks/task-badges';
import { MilestoneFormModal } from './milestone-form-modal';

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
      <div className="h-full rounded-full bg-action-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function MilestoneList({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('milestones.list');
  const { data: milestones, isLoading } = useMilestones(orgSlug, projectKey);
  const [creating, setCreating] = useState(false);
  const [addingDeliverableTo, setAddingDeliverableTo] = useState<string | undefined>(undefined);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>{t('create')}</Button>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {isLoading ? null : milestones && milestones.length > 0 ? (
          milestones.map((m) => {
            const allAccepted = m.deliverablesTotal > 0 && m.deliverablesAccepted === m.deliverablesTotal;
            const deliverablePercent =
              m.deliverablesTotal === 0 ? 0 : Math.round((m.deliverablesAccepted / m.deliverablesTotal) * 100);
            return (
              <Card key={m.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden="true" className="text-action-primary">
                    ◆
                  </span>
                  <span className="font-mono text-xs text-ink-muted">{m.humanKey}</span>
                  <Link
                    href={`/${orgSlug}/projects/${projectKey}/tasks/${m.id}`}
                    className="flex-1 font-medium text-ink-primary hover:underline"
                  >
                    {m.title}
                  </Link>
                  {m.isOverdue && <Badge variant="danger">{t('overdue')}</Badge>}
                  <TaskStatusBadge status={m.status} />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-ink-muted">{t('dueDate')}</p>
                    <p className="text-ink-primary">{formatDate(m.dueDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">{t('assignee')}</p>
                    {m.assignee ? (
                      <span className="flex items-center gap-2 text-ink-primary">
                        <Avatar name={m.assignee.fullName} src={m.assignee.avatarUrl} size="sm" />
                        {m.assignee.fullName}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-ink-muted">
                      {t('deliverables')}{' '}
                      <span className="text-ink-secondary">
                        {m.deliverablesAccepted}/{m.deliverablesTotal}
                      </span>
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {m.deliverablesTotal === 0 ? (
                        <span className="text-xs text-ink-muted">{t('noDeliverables')}</span>
                      ) : (
                        <>
                          <Bar percent={deliverablePercent} />
                          {allAccepted && (
                            <Badge variant="success" aria-label={t('allAccepted')}>
                              ✓
                            </Badge>
                          )}
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setAddingDeliverableTo(m.id)}>
                        {t('addDeliverable')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card>
            <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
          </Card>
        )}
      </div>

      <MilestoneFormModal orgSlug={orgSlug} projectKey={projectKey} open={creating} onClose={() => setCreating(false)} />
      <DeliverableFormModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={addingDeliverableTo !== undefined}
        defaultTaskId={addingDeliverableTo}
        onClose={() => setAddingDeliverableTo(undefined)}
      />
    </div>
  );
}
