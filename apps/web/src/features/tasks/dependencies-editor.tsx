'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCreateDependency, useDeleteDependency, useDependencies, useTasks, ApiError } from '@pmtool/api-client';
import { Button, Select } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';

export function DependenciesEditor({
  orgSlug,
  projectKey,
  taskId,
}: {
  orgSlug: string;
  projectKey: string;
  taskId: string;
}) {
  const t = useTranslations('tasks.detail');
  const { data: allTasks } = useTasks(orgSlug, projectKey);
  const { data: dependencies } = useDependencies(orgSlug, projectKey);
  const createDependency = useCreateDependency(orgSlug, projectKey);
  const deleteDependency = useDeleteDependency(orgSlug, projectKey);

  const [adding, setAdding] = useState(false);
  const [otherTaskId, setOtherTaskId] = useState('');
  const [direction, setDirection] = useState<'predecessor' | 'successor'>('predecessor');

  const taskById = new Map((allTasks ?? []).map((tsk) => [tsk.id, tsk]));
  const predecessors = (dependencies ?? []).filter((d) => d.successorId === taskId);
  const successors = (dependencies ?? []).filter((d) => d.predecessorId === taskId);
  const pickableTasks = (allTasks ?? []).filter((tsk) => tsk.id !== taskId);

  const submitAdd = () => {
    if (!otherTaskId) return;
    const input =
      direction === 'predecessor'
        ? { predecessorId: otherTaskId, successorId: taskId }
        : { predecessorId: taskId, successorId: otherTaskId };
    createDependency.mutate(input, {
      onSuccess: () => {
        setAdding(false);
        setOtherTaskId('');
      },
    });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-secondary">{t('dependencies')}</h3>

      <div className="mt-3 flex flex-col gap-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('predecessors')}</p>
          {predecessors.length === 0 && <p className="text-ink-muted">—</p>}
          {predecessors.map((dep) => {
            const other = taskById.get(dep.predecessorId);
            return (
              <div key={dep.id} className="flex items-center justify-between py-1">
                <Link href={`/${orgSlug}/projects/${projectKey}/tasks/${dep.predecessorId}`} className="hover:underline">
                  {other ? `${other.humanKey} — ${other.title}` : dep.predecessorId}
                </Link>
                <button
                  type="button"
                  onClick={() => deleteDependency.mutate(dep.id)}
                  className="text-xs text-ink-muted hover:text-danger"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('successors')}</p>
          {successors.length === 0 && <p className="text-ink-muted">—</p>}
          {successors.map((dep) => {
            const other = taskById.get(dep.successorId);
            return (
              <div key={dep.id} className="flex items-center justify-between py-1">
                <Link href={`/${orgSlug}/projects/${projectKey}/tasks/${dep.successorId}`} className="hover:underline">
                  {other ? `${other.humanKey} — ${other.title}` : dep.successorId}
                </Link>
                <button
                  type="button"
                  onClick={() => deleteDependency.mutate(dep.id)}
                  className="text-xs text-ink-muted hover:text-danger"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {adding ? (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-line p-3">
          <Select value={direction} onChange={(e) => setDirection(e.target.value as 'predecessor' | 'successor')}>
            <option value="predecessor">{t('predecessors')}</option>
            <option value="successor">{t('successors')}</option>
          </Select>
          <Select value={otherTaskId} onChange={(e) => setOtherTaskId(e.target.value)}>
            <option value="">—</option>
            {pickableTasks.map((tsk) => (
              <option key={tsk.id} value={tsk.id}>
                {tsk.humanKey} — {tsk.title}
              </option>
            ))}
          </Select>
          {createDependency.isError && (
            <p role="alert" className="text-xs text-danger">
              {createDependency.error instanceof ApiError ? createDependency.error.message : 'Có lỗi xảy ra'}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Hủy
            </Button>
            <Button type="button" size="sm" onClick={submitAdd} disabled={!otherTaskId || createDependency.isPending}>
              {t('addDependency')}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setAdding(true)}>
          {t('addDependency')}
        </Button>
      )}
    </div>
  );
}
