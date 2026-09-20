'use client';

import { useEffect, useRef, useState } from 'react';
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
import { Avatar, Button, Card, Input, Modal, Select } from '@pmtool/ui';
import { Link, useRouter } from '../../i18n/navigation';
import { dateInputToIso, isoToDateInput } from '../../lib/date-input';
import { TaskStatusBadge } from './task-badges';
import { AssigneesEditor } from './assignees-editor';
import { CommentsSection } from './comments-section';
import { DependenciesEditor } from './dependencies-editor';
import { CreateTaskModal } from './create-task-modal';
import { SuggestionsModal } from '../ai/suggestions-modal';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Turns a mutation's lifecycle into a visible "saving / saved / failed" state — edits here save on their own, so silence reads as "did it work?". */
function useSaveStatus(m: { isPending: boolean; isSuccess: boolean; isError: boolean }): SaveStatus {
  const [showSaved, setShowSaved] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    if (m.isPending) {
      wasPending.current = true;
      setShowSaved(false);
    } else if (wasPending.current && m.isSuccess) {
      wasPending.current = false;
      setShowSaved(true);
      const id = setTimeout(() => setShowSaved(false), 2500);
      return () => clearTimeout(id);
    } else if (m.isError) {
      wasPending.current = false;
    }
  }, [m.isPending, m.isSuccess, m.isError]);
  if (m.isPending) return 'saving';
  if (m.isError) return 'error';
  return showSaved ? 'saved' : 'idle';
}

function EditableTitle({ value, label, onSave }: { value: string; label: string; onSave: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else setDraft(value);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="min-w-0 flex-1 text-lg font-semibold"
      />
    );
  }
  return (
    <h1 className="min-w-0 text-lg font-semibold text-ink-primary">
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={label}
        className="-mx-1 rounded px-1 text-left hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {value}
      </button>
    </h1>
  );
}

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
  const [percentComplete, setPercentComplete] = useState('0');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dateError, setDateError] = useState(false);
  const saveStatus = useSaveStatus(updateTask);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [subtaskSuggestions, setSubtaskSuggestions] = useState<TaskSuggestionDto[] | null>(null);

  useEffect(() => {
    setDescription(task?.description ?? '');
  }, [task?.description]);

  useEffect(() => {
    setPercentComplete(String(task?.percentComplete ?? 0));
  }, [task?.percentComplete]);

  useEffect(() => {
    setStartDate(isoToDateInput(task?.startDate));
    setDueDate(isoToDateInput(task?.dueDate));
    setDateError(false);
  }, [task?.startDate, task?.dueDate]);

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

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs font-semibold text-ink-muted">
          {task.isMilestone && (
            <span aria-hidden="true" className="mr-1 text-action-primary">
              ◆
            </span>
          )}
          {task.humanKey}
        </span>
        <EditableTitle value={task.title} label={t('editTitle')} onSave={(title) => updateTask.mutate({ title })} />
        <span role="status" aria-live="polite" className="text-xs">
          {saveStatus === 'saving' && <span className="text-ink-muted">{t('saving')}</span>}
          {saveStatus === 'saved' && <span className="text-success">✓ {t('saved')}</span>}
          {saveStatus === 'error' && (
            <span role="alert" className="text-danger">
              {updateTask.error instanceof ApiError ? updateTask.error.message : t('saveError')}
            </span>
          )}
        </span>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-secondary">
                {t('subtasks')}
                {subtasks.length > 0 && (
                  <span className="ml-2 font-normal text-ink-muted">
                    {subtasks.filter((x) => x.status === 'DONE').length}/{subtasks.length}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
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
                  <span className="shrink-0 font-mono text-xs text-ink-muted">{sub.humanKey}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-primary" title={sub.title}>
                    {sub.title}
                  </span>
                  {sub.percentComplete > 0 && (
                    <span className="hidden shrink-0 text-xs tabular-nums text-ink-secondary sm:inline">
                      {sub.percentComplete}%
                    </span>
                  )}
                  {sub.assignees.find((a) => a.role === 'PRIMARY') && (
                    <Avatar
                      name={sub.assignees.find((a) => a.role === 'PRIMARY')!.fullName}
                      src={sub.assignees.find((a) => a.role === 'PRIMARY')!.avatarUrl}
                      size="sm"
                    />
                  )}
                  <TaskStatusBadge status={sub.status} />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <CommentsSection orgSlug={orgSlug} projectKey={projectKey} taskId={task.id} />
          </Card>
        </div>

        {/* First on small screens: status and assignee are what you come here to change, and on a phone they'd otherwise sit below the whole comment thread. */}
        <div className="order-first flex flex-col gap-6 lg:order-none">
          <Card className="flex flex-col gap-4 p-6">
            <div className="grid grid-cols-2 gap-3">
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
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink-secondary">{t('priority')}</h3>
                <Select
                  className="mt-2"
                  value={task.priority}
                  onChange={(e) =>
                    updateTask.mutate({
                      priority: e.target.value as (typeof TASK_PRIORITIES)[number],
                    })
                  }
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {tPriority(p)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="task-start" className="text-sm font-semibold text-ink-secondary">
                    {t('startDate')}
                  </label>
                  <Input
                    id="task-start"
                    type="date"
                    className="mt-2"
                    value={task.isMilestone ? dueDate : startDate}
                    disabled={task.isMilestone}
                    invalid={dateError}
                    onChange={(e) => {
                      const next = e.target.value;
                      setStartDate(next);
                      if (next && dueDate && next > dueDate) return setDateError(true);
                      setDateError(false);
                      updateTask.mutate({ startDate: next ? dateInputToIso(next) : null });
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="task-due" className="text-sm font-semibold text-ink-secondary">
                    {t('dueDate')}
                  </label>
                  <Input
                    id="task-due"
                    type="date"
                    className="mt-2"
                    value={dueDate}
                    invalid={dateError}
                    // A milestone must always keep a due date; clearing is only offered for ordinary tasks.
                    onChange={(e) => {
                      const next = e.target.value;
                      setDueDate(next);
                      if (task.isMilestone && !next) return;
                      if (next && startDate && !task.isMilestone && startDate > next) return setDateError(true);
                      setDateError(false);
                      updateTask.mutate({ dueDate: next ? dateInputToIso(next) : null });
                    }}
                  />
                </div>
              </div>
              {dateError && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {t('dateOrderError')}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink-secondary">{t('percentComplete')}</h3>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={percentComplete}
                  onChange={(e) => setPercentComplete(e.target.value)}
                  onBlur={() => {
                    const clamped = Math.min(100, Math.max(0, Math.round(Number(percentComplete) || 0)));
                    if (clamped !== task.percentComplete) {
                      updateTask.mutate({ percentComplete: clamped });
                    }
                    setPercentComplete(String(clamped));
                  }}
                  className="w-20 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
                <span className="text-sm text-ink-secondary">%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                <div className="h-full rounded-full bg-action-primary" style={{ width: `${task.percentComplete}%` }} />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-secondary">
                <input
                  type="checkbox"
                  checked={task.isMilestone}
                  disabled={!task.isMilestone && !task.dueDate}
                  onChange={(e) => updateTask.mutate({ isMilestone: e.target.checked })}
                  className="h-4 w-4 accent-action-primary"
                />
                {t('isMilestone')}
              </label>
              <p className="mt-1 text-xs text-ink-muted">
                {!task.isMilestone && !task.dueDate ? t('isMilestoneNeedsDue') : t('isMilestoneHint')}
              </p>
              {updateTask.isError && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {updateTask.error instanceof ApiError ? updateTask.error.message : 'Có lỗi xảy ra'}
                </p>
              )}
            </div>

            <AssigneesEditor orgSlug={orgSlug} task={task} onChange={(change) => updateTask.mutate(change)} />
          </Card>

          <Card className="p-6">
            <DependenciesEditor orgSlug={orgSlug} projectKey={projectKey} taskId={task.id} />
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-danger hover:text-danger"
          onClick={() => setConfirmDelete(true)}
        >
          {t('delete')}
        </Button>
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
