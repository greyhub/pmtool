'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTasks } from '@pmtool/api-client';
import { Button, Card } from '@pmtool/ui';
import { TaskTree } from './task-tree';
import { CreateTaskModal } from './create-task-modal';

export function TaskList({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('tasks.list');
  const { data: tasks, isLoading } = useTasks(orgSlug, projectKey);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-secondary">{t('title')}</h2>
        <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
      </div>

      <Card className="mt-4">
        {isLoading ? null : tasks && tasks.length > 0 ? (
          <TaskTree tasks={tasks} orgSlug={orgSlug} projectKey={projectKey} />
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>

      <CreateTaskModal orgSlug={orgSlug} projectKey={projectKey} open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
