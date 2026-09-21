'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useCreateTask, useMoveTask, useTasks } from '@pmtool/api-client';
import {
  computeWbsCodes,
  defaultChildType,
  legalChildTypes,
  WBS_NODE_TYPES,
  type TaskDto,
  type WbsNodeType,
} from '@pmtool/shared-types';
import { Button, Card, Input, Select } from '@pmtool/ui';
import { NodeTypeBadge } from './node-type-badge';
import { WbsDictionaryPanel } from './wbs-dictionary-panel';
import { AutoLevelModal, BulkSelectionBar } from './bulk-level-tools';
import { neighbourSiblings, planMove, type DropZone } from './wbs-move';
import { usePermissions } from '../projects/use-permissions';

interface Row {
  task: TaskDto;
  code: string;
  depth: number;
  hasChildren: boolean;
}

function flatten(tasks: TaskDto[], codes: Map<string, string>, expanded: Set<string>): Row[] {
  const ids = new Set(tasks.map((t) => t.id));
  const children = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const key = task.parentTaskId && ids.has(task.parentTaskId) ? task.parentTaskId : null;
    const list = children.get(key) ?? [];
    list.push(task);
    children.set(key, list);
  }
  const rows: Row[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const list = (children.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id));
    for (const task of list) {
      const kids = children.get(task.id) ?? [];
      rows.push({ task, code: codes.get(task.id) ?? '', depth, hasChildren: kids.length > 0 });
      if (kids.length > 0 && expanded.has(task.id)) walk(task.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

export function WbsView({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('wbs');
  const tType = useTranslations('tasks.nodeType');
  const tHelp = useTranslations('tasks.nodeTypeHelp');
  const { data: tasks, isLoading } = useTasks(orgSlug, projectKey);
  const createTask = useCreateTask(orgSlug, projectKey);
  const moveTask = useMoveTask(orgSlug, projectKey);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; zone: DropZone } | null>(null);
  const { canEdit } = usePermissions(orgSlug, projectKey);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkLevel, setBulkLevel] = useState<WbsNodeType>('WORK_PACKAGE');
  const [autoOpen, setAutoOpen] = useState(false);
  // `null` parent = adding a root; undefined = the add form is closed.
  const [adding, setAdding] = useState<{ parentId: string | null; type: WbsNodeType; title: string } | null>(null);

  const all = useMemo(() => tasks ?? [], [tasks]);
  const codes = useMemo(() => computeWbsCodes(all), [all]);
  const rows = useMemo(() => flatten(all, codes, expanded), [all, codes, expanded]);
  const selected = all.find((x) => x.id === selectedId) ?? null;
  const parentIds = useMemo(
    () => Array.from(new Set(all.map((x) => x.parentTaskId).filter((x): x is string => !!x))),
    [all],
  );

  // A small tree opens fully the first time it loads; a big one stays folded.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || all.length === 0) return;
    seeded.current = true;
    if (all.length <= 80) setExpanded(new Set(parentIds));
  }, [all, parentIds]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function startAdd(parent: TaskDto | null) {
    setAdding({
      parentId: parent?.id ?? null,
      type: parent ? defaultChildType(parent.nodeType) : 'PHASE',
      title: '',
    });
    if (parent) setExpanded((prev) => new Set(prev).add(parent.id));
  }

  function submitAdd() {
    if (!adding || adding.title.trim() === '') return;
    createTask.mutate(
      { title: adding.title.trim(), parentTaskId: adding.parentId ?? undefined, nodeType: adding.type },
      { onSuccess: () => setAdding(null) },
    );
  }

  function moveTo(taskId: string, targetId: string, zone: DropZone) {
    const plan = planMove(all, taskId, targetId, zone);
    if (!plan) return;
    if (zone === 'inside') setExpanded((prev) => new Set(prev).add(targetId));
    moveTask.mutate({ taskId, input: plan });
  }

  /** Keyboard/mouse alternatives to dragging: step past a sibling, indent under the previous one, or outdent. */
  function step(task: TaskDto, action: 'up' | 'down' | 'indent' | 'outdent') {
    const { prev, next } = neighbourSiblings(all, task.id);
    if (action === 'up' && prev) moveTo(task.id, prev.id, 'before');
    if (action === 'down' && next) moveTo(task.id, next.id, 'after');
    if (action === 'indent' && prev) moveTo(task.id, prev.id, 'inside');
    if (action === 'outdent' && task.parentTaskId) moveTo(task.id, task.parentTaskId, 'after');
  }

  if (isLoading) return null;

  const addForm = (parent: TaskDto | null, depth: number) =>
    adding && adding.parentId === (parent?.id ?? null) ? (
      <li
        key="add-form"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        className="flex flex-wrap items-center gap-2 py-2 pr-3"
      >
        <Select
          aria-label="type"
          value={adding.type}
          onChange={(e) => setAdding({ ...adding, type: e.target.value as WbsNodeType })}
          className="w-auto"
        >
          {(parent ? legalChildTypes(parent.nodeType) : [...WBS_NODE_TYPES]).map((type) => (
            <option key={type} value={type}>
              {tType(type)}
            </option>
          ))}
        </Select>
        <Input
          autoFocus
          aria-label={t('newTitle', { type: tType(adding.type) })}
          placeholder={t('newTitle', { type: tType(adding.type) })}
          value={adding.title}
          onChange={(e) => setAdding({ ...adding, title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitAdd();
            if (e.key === 'Escape') setAdding(null);
          }}
          className="min-w-[12rem] flex-1"
        />
        <Button size="sm" disabled={createTask.isPending || adding.title.trim() === ''} onClick={submitAdd}>
          {t('create')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
          {t('cancel')}
        </Button>
        {createTask.isError && (
          <span role="alert" className="w-full text-sm text-danger">
            {createTask.error instanceof ApiError ? createTask.error.message : 'Có lỗi xảy ra'}
          </span>
        )}
      </li>
    ) : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="max-w-2xl text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(parentIds))}>
            {t('expandAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
            {t('collapseAll')}
          </Button>
          {canEdit && all.length > 0 && (
            <>
              <Button
                variant={selecting ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={selecting}
                onClick={() => {
                  setSelecting((v) => !v);
                  setPicked(new Set());
                }}
              >
                {t('bulk.selectMode')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAutoOpen(true)}>
                {t('bulk.auto')}
              </Button>
            </>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => startAdd(null)}>
              {t('addRoot')}
            </Button>
          )}
        </div>
      </div>

      {moveTask.isError && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {moveTask.error instanceof ApiError ? moveTask.error.message : t('move.error')}
        </p>
      )}

      {selecting && (
        <BulkSelectionBar
          orgSlug={orgSlug}
          projectKey={projectKey}
          picked={Array.from(picked)}
          total={all.length}
          level={bulkLevel}
          onLevel={setBulkLevel}
          onSelectAll={() => setPicked(new Set(all.map((x) => x.id)))}
          onClear={() => setPicked(new Set())}
          onDone={() => {
            setPicked(new Set());
            setSelecting(false);
          }}
        />
      )}
      <AutoLevelModal orgSlug={orgSlug} projectKey={projectKey} open={autoOpen} onClose={() => setAutoOpen(false)} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          {all.length === 0 && !adding ? (
            <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-line" data-testid="wbs-tree">
              {addForm(null, 0)}
              {rows.map(({ task, code, depth, hasChildren }) => {
                const isOpen = expanded.has(task.id);
                const canAdd = canEdit && legalChildTypes(task.nodeType).length > 0;
                return (
                  <li key={task.id}>
                    <div
                      style={{ paddingLeft: `${depth * 20 + 8}px` }}
                      data-testid={`wbs-row-${task.humanKey}`}
                      draggable={canEdit && !selecting}
                      onDragStart={(e) => {
                        setDragId(task.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', task.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        const box = e.currentTarget.getBoundingClientRect();
                        const y = (e.clientY - box.top) / box.height;
                        const zone: DropZone = y < 0.25 ? 'before' : y > 0.75 ? 'after' : 'inside';
                        if (!planMove(all, dragId, task.id, zone)) {
                          setOver(null);
                          return;
                        }
                        e.preventDefault(); // this spot accepts the drop
                        e.dataTransfer.dropEffect = 'move';
                        if (over?.id !== task.id || over.zone !== zone) setOver({ id: task.id, zone });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId && over) moveTo(dragId, over.id, over.zone);
                        setDragId(null);
                        setOver(null);
                      }}
                      className={`group relative flex items-center gap-2 py-1.5 pr-2 ${
                        selectedId === task.id ? 'bg-action-primary/10' : 'hover:bg-surface-subtle'
                      } ${dragId === task.id ? 'opacity-40' : ''} ${
                        over?.id === task.id && over.zone === 'inside' ? 'ring-2 ring-inset ring-action-primary' : ''
                      } ${over?.id === task.id && over.zone === 'before' ? 'border-t-2 border-action-primary' : ''} ${
                        over?.id === task.id && over.zone === 'after' ? 'border-b-2 border-action-primary' : ''
                      }`}
                    >
                      {selecting && (
                        <input
                          type="checkbox"
                          aria-label={`${code} ${task.title}`}
                          checked={picked.has(task.id)}
                          onChange={(e) =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(task.id);
                              else next.delete(task.id);
                              return next;
                            })
                          }
                          className="h-4 w-4 shrink-0 accent-action-primary"
                        />
                      )}
                      <button
                        type="button"
                        aria-label={isOpen ? 'collapse' : 'expand'}
                        aria-expanded={hasChildren ? isOpen : undefined}
                        disabled={!hasChildren}
                        onClick={() => toggle(task.id)}
                        className="h-6 w-6 shrink-0 rounded text-ink-muted hover:bg-surface-subtle disabled:opacity-30"
                      >
                        {hasChildren ? (isOpen ? '▾' : '▸') : '·'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedId(task.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="w-14 shrink-0 font-mono text-xs text-ink-muted">{code}</span>
                        <NodeTypeBadge type={task.nodeType} />
                        <span className="truncate text-sm text-ink-primary">
                          {task.isMilestone ? '◆ ' : ''}
                          {task.title}
                        </span>
                      </button>
                      {canEdit && !selecting && (
                        <span className="flex shrink-0 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                          {(
                            [
                              ['up', '↑', t('move.up')],
                              ['down', '↓', t('move.down')],
                              ['outdent', '←', t('move.outdent')],
                              ['indent', '→', t('move.indent')],
                            ] as const
                          ).map(([action, glyph, label]) => (
                            <button
                              key={action}
                              type="button"
                              aria-label={`${label}: ${task.title}`}
                              title={label}
                              onClick={() => step(task, action)}
                              className="h-6 w-6 rounded text-xs text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
                            >
                              {glyph}
                            </button>
                          ))}
                        </span>
                      )}
                      {canAdd && (
                        <button
                          type="button"
                          aria-label={t('addChild')}
                          title={t('addChild')}
                          onClick={() => startAdd(task)}
                          className="h-6 w-6 shrink-0 rounded text-ink-muted hover:bg-surface-subtle hover:text-ink-primary"
                        >
                          +
                        </button>
                      )}
                    </div>
                    {isOpen || adding?.parentId === task.id ? <ul>{addForm(task, depth + 1)}</ul> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div>
          {selected ? (
            <WbsDictionaryPanel
              key={selected.id}
              orgSlug={orgSlug}
              projectKey={projectKey}
              task={selected}
              code={codes.get(selected.id) ?? ''}
            />
          ) : (
            <Card className="p-6 text-sm text-ink-secondary">
              <p>{t('selectHint')}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {WBS_NODE_TYPES.map((type) => (
                  <li key={type} className="flex items-start gap-2">
                    <NodeTypeBadge type={type} />
                    <span>{tHelp(type)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
