'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  useDeleteTask,
  useSuggestSubtasks,
  useSummarizeTask,
  useTask,
  useTasks,
  useUpdateTask,
} from '@pmtool/api-client';
import type { TaskSuggestionDto } from '@pmtool/shared-types';
import { TASK_PRIORITIES, TASK_STATUSES } from '@pmtool/shared-types';
import { Button, Card, Modal, Select } from '@pmtool/ui';
import { Link, useRouter } from '../../i18n/navigation';
import { TaskPriorityBadge, TaskStatusBadge } from './task-badges';
import { AssigneesEditor } from './assignees-editor';
import { CommentsSection } from './comments-section';
import { DependenciesEditor } from './dependencies-editor';
import { CreateTaskModal } from './create-task-modal';
import { SuggestionsModal } from '../ai/suggestions-modal';

export function TaskDetail({ orgSlug, projectKey, taskId }: { orgSlug: string; projectKey: string; taskId: string }) {
  const t = useTranslations('tasks.detail');
  const tStatus = useTranslations('tasks.status');
  const tPriority = useTranslations('tasks.priority');
  const tListLabels = useTranslations('tasks.list');
  const tAi = useTranslations('ai.task');
  const router = useRouter();

  const { data: task } = useTask(orgSlug, projectKey, taskId);
  const { data: allTasks } = useTasks(orgSlug, projectKey);
  const updateTask = useUpdateTask(orgSlug, projectKey, taskId);
  const deleteTask = useDeleteTask(orgSlug, projectKey);
  const summarizeTask = useSummarizeTask(orgSlug, projectKey);
  const suggestSubtasks = useSuggestSubtasks(orgSlug, projectKey);

  const [description, setDescription] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [subtaskSuggestions, setSubtaskSuggestions] = useState<TaskSuggestionDto[] | null>(null);

  useEffect(() => {
    setDescription(task?.description ?? '');
  }, [task?.description]);

  if (!task) return null;

  const subtasks = (allTasks ?? []).filter((tsk) => tsk.parentTaskId === task.id);
  const parent = task.parentTaskId ? (allTasks ?? []).find((tsk) => tsk.id === task.parentTaskId) : undefined;

  return (
    <div>
      <Link href={`/${orgSlug}/projects/${projectKey}/tasks`} className="text-sm text-ink-secondary hover:underline">
        ← {t('backToList')}
      </Link>

      {parent && (
        <p className="mt-2 text-xs text-ink-muted">
          <Link href={`/${orgSlug}/projects/${projectKey}/tasks/${parent.id}`} className="hover:underline">
            {parent.humanKey} — {parent.title}
          </Link>
        </p>
      )}

      <div className="mt-1 flex items-center gap-3">
        <span className="font-mono text-xs font-semibold text-ink-muted">{task.humanKey}</span>
        <h1 className="text-lg font-semibold text-ink-primary">{task.title}</h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-secondary">{t('description')}</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={summarizeTask.isPending}
                onClick={() => summarizeTask.mutate(task.id)}
              >
                {tAi('summarize')}
              </Button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (task.description ?? '')) {
                  updateTask.mutate({ description: description || null });
                }
              }}
              placeholder={t('descriptionPlaceholder')}
              rows={5}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            {summarizeTask.isError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {summarizeTask.error instanceof ApiError ? summarizeTask.error.message : 'Có lỗi xảy ra'}
              </p>
            )}
            {summarizeTask.data && (
              <div className="mt-2 rounded-md bg-surface-subtle p-3 text-sm text-ink-secondary">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">{tAi('summaryLabel')}</p>
                {summarizeTask.data.summary}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-secondary">{t('subtasks')}</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={suggestSubtasks.isPending}
                  onClick={() =>
                    suggestSubtasks.mutate(task.id, {
                      onSuccess: (data) => setSubtaskSuggestions(data.suggestions),
                    })
                  }
                >
                  {tAi('suggestSubtasks')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAddingSubtask(true)}>
                  {tListLabels('addSubtask')}
                </Button>
              </div>
            </div>
            {suggestSubtasks.isError && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {suggestSubtasks.error instanceof ApiError ? suggestSubtasks.error.message : 'Có lỗi xảy ra'}
              </p>
            )}
            <div className="mt-2 flex flex-col">
              {subtasks.length === 0 && <p className="py-2 text-sm text-ink-muted">{tListLabels('empty')}</p>}
              {subtasks.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/${orgSlug}/projects/${projectKey}/tasks/${sub.id}`}
                  className="flex items-center gap-3 border-b border-line py-2 text-sm last:border-b-0 hover:bg-surface-subtle"
                >
                  <span className="font-mono text-xs text-ink-muted">{sub.humanKey}</span>
                  <span className="flex-1 text-ink-primary">{sub.title}</span>
                  <TaskStatusBadge status={sub.status} />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <CommentsSection orgSlug={orgSlug} projectKey={projectKey} taskId={task.id} />
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-6">
            <div>
              <h3 className="text-sm font-semibold text-ink-secondary">{t('status')}</h3>
              <Select
                className="mt-2"
                value={task.status}
                onChange={(e) => updateTask.mutate({ status: e.target.value as (typeof TASK_STATUSES)[number] })}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tStatus(s)}
                  </option>
                ))}
              </Select>
              <div className="mt-2">
                <TaskStatusBadge status={task.status} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink-secondary">{t('priority')}</h3>
              <Select
                className="mt-2"
                value={task.priority}
                onChange={(e) => updateTask.mutate({ priority: e.target.value as (typeof TASK_PRIORITIES)[number] })}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {tPriority(p)}
                  </option>
                ))}
              </Select>
              <div className="mt-2">
                <TaskPriorityBadge priority={task.priority} />
              </div>
            </div>

            <AssigneesEditor orgSlug={orgSlug} task={task} onChange={(assigneeIds) => updateTask.mutate({ assigneeIds })} />
          </Card>

          <Card className="p-6">
            <DependenciesEditor orgSlug={orgSlug} projectKey={projectKey} taskId={task.id} />
          </Card>

          <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
            {t('delete')}
          </Button>
        </div>
      </div>

      <CreateTaskModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        parentTaskId={task.id}
        open={addingSubtask}
        onClose={() => setAddingSubtask(false)}
      />

      {subtaskSuggestions && (
        <SuggestionsModal
          orgSlug={orgSlug}
          projectKey={projectKey}
          title={tAi('suggestSubtasksTitle')}
          suggestions={subtaskSuggestions}
          parentTaskId={task.id}
          open={subtaskSuggestions !== null}
          onClose={() => setSubtaskSuggestions(null)}
        />
      )}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDescription')}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() =>
                deleteTask.mutate(task.id, {
                  onSuccess: () => router.push(`/${orgSlug}/projects/${projectKey}/tasks`),
                })
              }
            >
              {t('delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}
