'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTasks } from '@pmtool/api-client';
import type { TaskSuggestionDto } from '@pmtool/shared-types';
import { Button, Card } from '@pmtool/ui';
import { TaskTree } from './task-tree';
import { CreateTaskModal } from './create-task-modal';
import { NlTaskModal } from '../ai/nl-task-modal';
import { SuggestionsModal } from '../ai/suggestions-modal';

export function TaskList({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('tasks.list');
  const tAi = useTranslations('ai.nlCreate');
  const { data: tasks, isLoading } = useTasks(orgSlug, projectKey);
  const [createOpen, setCreateOpen] = useState(false);
  const [nlCreateOpen, setNlCreateOpen] = useState(false);
  const [nlSuggestions, setNlSuggestions] = useState<TaskSuggestionDto[] | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-secondary">{t('title')}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNlCreateOpen(true)}>
            {tAi('trigger')}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
        </div>
      </div>

      <Card className="mt-4">
        {isLoading ? null : tasks && tasks.length > 0 ? (
          <TaskTree tasks={tasks} orgSlug={orgSlug} projectKey={projectKey} />
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>

      <CreateTaskModal orgSlug={orgSlug} projectKey={projectKey} open={createOpen} onClose={() => setCreateOpen(false)} />

      <NlTaskModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={nlCreateOpen}
        onClose={() => setNlCreateOpen(false)}
        onSuggestions={setNlSuggestions}
      />

      {nlSuggestions && (
        <SuggestionsModal
          orgSlug={orgSlug}
          projectKey={projectKey}
          title={tAi('suggestionsTitle')}
          suggestions={nlSuggestions}
          open={nlSuggestions !== null}
          onClose={() => setNlSuggestions(null)}
        />
      )}
    </div>
  );
}
