'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SprintDto, TaskDto } from '@pmtool/shared-types';
import {
  ApiError,
  useCloseSprint,
  useCreateSprint,
  useDeleteSprint,
  useProject,
  useSprints,
  useStartSprint,
  useTasks,
  useUpdateTaskById,
} from '@pmtool/api-client';
import { Badge, Button, Card, FormField, Input, Modal, Select } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { usePermissions } from '../projects/use-permissions';
import { TaskStatusBadge } from '../tasks/task-badges';
import { velocityOf } from './velocity';

const BACKLOG = '__backlog__';
const STATUS_VARIANT = { PLANNED: 'neutral', ACTIVE: 'success', CLOSED: 'info' } as const;

function fmtDate(iso: string) {
  return iso.slice(0, 10);
}

function fmtLoad(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function messageOf(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function TaskRow({
  task,
  unit,
  canEdit,
  sprintOptions,
  onMove,
  onPoints,
  orgSlug,
  projectKey,
}: {
  task: TaskDto;
  unit: 'POINTS' | 'HOURS';
  canEdit: boolean;
  sprintOptions: SprintDto[];
  onMove: (sprintId: string | null) => void;
  onPoints: (v: number | null) => void;
  orgSlug: string;
  projectKey: string;
}) {
  const t = useTranslations('sprints');
  return (
    <li
      draggable={canEdit}
      onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
      className="flex flex-col gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm"
      data-testid={`sprint-task-${task.humanKey}`}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-ink-muted">{task.humanKey}</span>
        <Link
          href={`/${orgSlug}/projects/${projectKey}/tasks/${task.id}`}
          className="min-w-0 flex-1 text-ink-primary hover:underline"
        >
          {task.title}
        </Link>
      </div>
      <div className="flex w-full items-center gap-2">
        <TaskStatusBadge status={task.status} />
        <span className="flex-1" />
        {unit === 'POINTS' ? (
          <Input
            aria-label={t('storyPoints')}
            type="number"
            min={0}
            step={1}
            className="w-16"
            disabled={!canEdit}
            key={task.storyPoints ?? 'none'}
            defaultValue={task.storyPoints ?? ''}
            onBlur={(e) => {
              const v = e.target.value === '' ? null : Number(e.target.value);
              if (v !== task.storyPoints) onPoints(v);
            }}
          />
        ) : (
          <span className="w-16 text-right text-xs text-ink-muted">{task.estimateHours ?? 0}h</span>
        )}
        {canEdit && (
          <Select
            aria-label={t('moveTo', { title: task.title })}
            className="row-actions w-36"
            value={task.sprintId ?? BACKLOG}
            onChange={(e) => onMove(e.target.value === BACKLOG ? null : e.target.value)}
          >
            <option value={BACKLOG}>{t('backlog')}</option>
            {sprintOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </div>
    </li>
  );
}

function LoadBar({
  planned,
  done,
  velocity,
  unitLabel,
}: {
  planned: number;
  done: number;
  velocity: number | null;
  unitLabel: string;
}) {
  const t = useTranslations('sprints');
  const scale = Math.max(planned, velocity ?? 0, 1);
  const over = velocity != null && planned > velocity;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${over ? 'bg-warning' : 'bg-action-primary'}`}
          style={{ width: `${(planned / scale) * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-success"
          style={{ width: `${(done / scale) * 100}%` }}
        />
        {velocity != null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-ink-primary"
            style={{ left: `${(velocity / scale) * 100}%` }}
            title={t('velocity')}
          />
        )}
      </div>
      <p className="text-xs text-ink-muted">
        {t('loadLine', { planned: fmtLoad(planned), done: fmtLoad(done), unit: unitLabel })}
        {velocity != null &&
          ` · ${t('velocityLine', { value: fmtLoad(velocity), unit: unitLabel })}`}
        {over && <span className="ml-1 font-semibold text-warning">{t('overCapacity')}</span>}
      </p>
    </div>
  );
}

export function SprintsView({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('sprints');
  const { data: project } = useProject(orgSlug, projectKey);
  const enabled = Boolean(project?.sprintsEnabled);
  const { data: sprints } = useSprints(orgSlug, projectKey, enabled);
  const { data: tasks } = useTasks(orgSlug, projectKey);
  const { canEdit, canManage } = usePermissions(orgSlug, projectKey);
  const updateTask = useUpdateTaskById(orgSlug, projectKey);
  const createSprint = useCreateSprint(orgSlug, projectKey);
  const startSprint = useStartSprint(orgSlug, projectKey);
  const closeSprint = useCloseSprint(orgSlug, projectKey);
  const deleteSprint = useDeleteSprint(orgSlug, projectKey);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [closing, setClosing] = useState<SprintDto | null>(null);
  const [carryTo, setCarryTo] = useState(BACKLOG);
  const [error, setError] = useState<string | null>(null);

  if (!project || !tasks) return null;
  if (!enabled) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
        <p className="mt-2 text-sm text-ink-secondary">{t('disabled')}</p>
        <Link
          href={`/${orgSlug}/projects/${projectKey}/settings`}
          className="mt-3 inline-block text-sm text-ink-primary underline"
        >
          {t('goSettings')}
        </Link>
      </Card>
    );
  }

  const unit = project.estimationUnit;
  const unitLabel = t(unit === 'POINTS' ? 'points' : 'hours');
  const all = sprints ?? [];
  const velocity = velocityOf(all);
  const open = all
    .filter((s) => s.status !== 'CLOSED')
    .sort((a, b) =>
      a.status === 'ACTIVE'
        ? -1
        : b.status === 'ACTIVE'
          ? 1
          : a.startDate.localeCompare(b.startDate),
    );
  const closed = all.filter((s) => s.status === 'CLOSED');
  const parentIds = new Set(tasks.map((x) => x.parentTaskId).filter(Boolean));
  const workItems = tasks.filter((x) => !parentIds.has(x.id));
  const backlog = workItems.filter((x) => !x.sprintId && x.status !== 'DONE');
  const backlogLoad = backlog.reduce(
    (sum, x) => sum + ((unit === 'POINTS' ? x.storyPoints : x.estimateHours) ?? 0),
    0,
  );

  const move = (taskId: string, sprintId: string | null) => {
    setError(null);
    updateTask.mutate(
      { taskId, input: { sprintId } },
      { onError: (e) => setError(messageOf(e, t('genericError'))) },
    );
  };
  const setPoints = (taskId: string, storyPoints: number | null) =>
    updateTask.mutate(
      { taskId, input: { storyPoints } },
      { onError: (e) => setError(messageOf(e, t('genericError'))) },
    );
  const dropOn = (sprintId: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task-id');
    if (id && canEdit) move(id, sprintId);
  };
  const rowProps = (task: TaskDto) => ({
    task,
    unit,
    canEdit,
    orgSlug,
    projectKey,
    sprintOptions: open,
    onMove: (sid: string | null) => move(task.id, sid),
    onPoints: (v: number | null) => setPoints(task.id, v),
  });

  const canCreate =
    form.name.trim() && form.startDate && form.endDate && form.startDate <= form.endDate;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle', { unit: unitLabel })}</p>
        </div>
        {canManage && <Button onClick={() => setCreating(true)}>{t('create')}</Button>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          className="flex flex-col gap-3 p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={dropOn(null)}
          data-testid="backlog-zone"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-primary">{t('backlog')}</h2>
            <span className="text-xs text-ink-muted">
              {t('backlogTotal', {
                count: backlog.length,
                load: fmtLoad(backlogLoad),
                unit: unitLabel,
              })}
            </span>
          </div>
          {backlog.length === 0 ? (
            <p className="text-sm text-ink-secondary">{t('backlogEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {backlog.map((x) => (
                <TaskRow key={x.id} {...rowProps(x)} />
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {open.length === 0 && <p className="text-sm text-ink-secondary">{t('noSprints')}</p>}
          {open.map((s) => {
            const items = workItems.filter((x) => x.sprintId === s.id);
            return (
              <Card
                key={s.id}
                className="flex flex-col gap-3 p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={dropOn(s.id)}
                data-testid={`sprint-zone-${s.name}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-ink-primary">{s.name}</h2>
                  <Badge variant={STATUS_VARIANT[s.status]}>{t(`status.${s.status}`)}</Badge>
                  <span className="text-xs text-ink-muted">
                    {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
                  </span>
                  <div className="ml-auto flex gap-2">
                    {canManage && s.status === 'PLANNED' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            startSprint.mutate(s.id, {
                              onError: (e) => setError(messageOf(e, t('genericError'))),
                            })
                          }
                        >
                          {t('start')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteSprint.mutate(s.id)}>
                          {t('delete')}
                        </Button>
                      </>
                    )}
                    {canManage && s.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCarryTo(BACKLOG);
                          setClosing(s);
                        }}
                      >
                        {t('close')}
                      </Button>
                    )}
                  </div>
                </div>
                {s.goal && <p className="text-sm text-ink-secondary">{s.goal}</p>}
                <LoadBar
                  planned={s.plannedLoad}
                  done={s.doneLoad}
                  velocity={velocity}
                  unitLabel={unitLabel}
                />
                {items.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('sprintEmpty')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {items.map((x) => (
                      <TaskRow key={x.id} {...rowProps(x)} />
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}

          {closed.length > 0 && (
            <Card className="flex flex-col gap-2 p-4">
              <h2 className="text-sm font-semibold text-ink-primary">{t('history')}</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {closed.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="text-ink-primary">{s.name}</span>
                    <span className="text-xs text-ink-muted">
                      {t('committedVsDone', {
                        committed: fmtLoad(s.committedLoad ?? 0),
                        done: fmtLoad(s.completedLoad ?? 0),
                        unit: unitLabel,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={t('create')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={!canCreate || createSprint.isPending}
              onClick={() =>
                createSprint.mutate(
                  {
                    name: form.name.trim(),
                    goal: form.goal.trim() || undefined,
                    startDate: new Date(form.startDate).toISOString(),
                    endDate: new Date(form.endDate).toISOString(),
                  },
                  {
                    onSuccess: () => {
                      setCreating(false);
                      setForm({ name: '', goal: '', startDate: '', endDate: '' });
                    },
                    onError: (e) => setError(messageOf(e, t('genericError'))),
                  },
                )
              }
            >
              {t('createSubmit')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label={t('name')} htmlFor="sprint-name">
            <Input
              id="sprint-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label={t('goal')} htmlFor="sprint-goal">
            <Input
              id="sprint-goal"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('startDate')} htmlFor="sprint-start">
              <Input
                id="sprint-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </FormField>
            <FormField label={t('endDate')} htmlFor="sprint-end">
              <Input
                id="sprint-end"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </FormField>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        title={t('closeTitle', { name: closing?.name ?? '' })}
        description={
          closing
            ? t('closeSummary', { done: closing.doneCount, total: closing.taskCount })
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(null)}>
              {t('cancel')}
            </Button>
            <Button
              disabled={closeSprint.isPending}
              onClick={() =>
                closing &&
                closeSprint.mutate(
                  {
                    sprintId: closing.id,
                    input: { moveUnfinishedTo: carryTo === BACKLOG ? null : carryTo },
                  },
                  {
                    onSuccess: () => setClosing(null),
                    onError: (e) => setError(messageOf(e, t('genericError'))),
                  },
                )
              }
            >
              {t('closeSubmit')}
            </Button>
          </>
        }
      >
        <FormField label={t('carryOver')} htmlFor="sprint-carry">
          <Select id="sprint-carry" value={carryTo} onChange={(e) => setCarryTo(e.target.value)}>
            <option value={BACKLOG}>{t('backlog')}</option>
            {all
              .filter((s) => s.status === 'PLANNED')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Select>
        </FormField>
      </Modal>
    </div>
  );
}
