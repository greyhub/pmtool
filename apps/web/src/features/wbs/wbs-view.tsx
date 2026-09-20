'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useCreateTask, useTasks } from '@pmtool/api-client';
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
  const { canEdit } = usePermissions(orgSlug, projectKey);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
          {canEdit && (
            <Button size="sm" onClick={() => startAdd(null)}>
              {t('addRoot')}
            </Button>
          )}
        </div>
      </div>

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
                      className={`group flex items-center gap-2 py-1.5 pr-2 ${selectedId === task.id ? 'bg-action-primary/10' : 'hover:bg-surface-subtle'}`}
                    >
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
