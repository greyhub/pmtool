'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useExportTasksCsv, useMe, useTasks } from '@pmtool/api-client';
import type { TaskSuggestionDto } from '@pmtool/shared-types';
import { TASK_STATUSES } from '@pmtool/shared-types';
import { Button, Card, Input, Select } from '@pmtool/ui';
import { TaskTree, useCollapsedRows } from './task-tree';
import { CreateTaskModal } from './create-task-modal';
import { ImportTasksModal } from './import-tasks-modal';
import { downloadFile } from '../../lib/download-json';
import {
  filterTasks,
  groupByStatus,
  hasActiveFilters,
  NO_FILTERS,
  sortTasks,
  type GroupKey,
  type SortKey,
  type TaskFilters,
} from './task-filters';
import { NlTaskModal } from '../ai/nl-task-modal';
import { SuggestionsModal } from '../ai/suggestions-modal';
import { usePermissions } from '../projects/use-permissions';

export function TaskList({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('tasks.list');
  const tStatus = useTranslations('tasks.status');
  const tAi = useTranslations('ai.nlCreate');
  const { data: tasks, isLoading } = useTasks(orgSlug, projectKey);
  const { data: me } = useMe();
  const { canEdit } = usePermissions(orgSlug, projectKey);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const exportCsv = useExportTasksCsv(orgSlug, projectKey);
  const [nlCreateOpen, setNlCreateOpen] = useState(false);
  const [nlSuggestions, setNlSuggestions] = useState<TaskSuggestionDto[] | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('DEFAULT');
  const [group, setGroup] = useState<GroupKey>('NONE');
  const rows = useCollapsedRows(orgSlug, projectKey);

  const filtering = hasActiveFilters(filters);
  const filtered = useMemo(() => filterTasks(tasks ?? [], filters, me?.id), [tasks, filters, me?.id]);
  const visible = useMemo(() => sortTasks(filtered.tasks, sort), [filtered.tasks, sort]);
  const groups = useMemo(() => (group === 'STATUS' ? groupByStatus(visible) : []), [group, visible]);
  const parentIds = useMemo(
    () => Array.from(new Set((tasks ?? []).map((x) => x.parentTaskId).filter((x): x is string => !!x))),
    [tasks],
  );

  // People who appear on any task, for the assignee filter.
  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks ?? []) for (const a of task.assignees) map.set(a.id, a.fullName);
    return Array.from(map.entries())
      .filter(([id]) => id !== me?.id)
      .sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [tasks, me?.id]);

  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink-primary">{t('title')}</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            disabled={exportCsv.isPending}
            onClick={() =>
              exportCsv.mutate(undefined, {
                onSuccess: (text) =>
                  downloadFile(`${projectKey}-wbs-${new Date().toISOString().slice(0, 10)}.csv`, text, 'text/csv'),
              })
            }
          >
            {t('exportCsv')}
          </Button>
          {canEdit && (
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              {t('importCsv')}
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setNlCreateOpen(true)}>
                {tAi('trigger')}
              </Button>
              <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
            </>
          )}
        </div>
      </div>

      {tasks && tasks.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="search">
          <Input
            type="search"
            value={filters.query}
            onChange={(e) => set('query', e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full sm:w-64"
          />
          <Select
            aria-label={t('filterStatus')}
            value={filters.status}
            onChange={(e) => set('status', e.target.value as TaskFilters['status'])}
            className="w-auto"
          >
            <option value="ALL">{t('allStatuses')}</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('filterAssignee')}
            value={filters.assignee}
            onChange={(e) => set('assignee', e.target.value)}
            className="w-auto"
          >
            <option value="ALL">{t('allAssignees')}</option>
            <option value="ME">{t('mine')}</option>
            <option value="NONE">{t('unassigned')}</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={filters.hideDone}
              onChange={(e) => set('hideDone', e.target.checked)}
              className="h-4 w-4 accent-action-primary"
            />
            {t('hideDone')}
          </label>

          <Select
            aria-label={t('sortLabel')}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-auto"
          >
            <option value="DEFAULT">{t('sortDefault')}</option>
            <option value="DUE">{t('sortDue')}</option>
            <option value="PRIORITY">{t('sortPriority')}</option>
          </Select>
          <Select
            aria-label={t('groupLabel')}
            value={group}
            onChange={(e) => setGroup(e.target.value as GroupKey)}
            className="w-auto"
          >
            <option value="NONE">{t('groupNone')}</option>
            <option value="STATUS">{t('groupStatus')}</option>
          </Select>
          <div className="ml-auto flex items-center gap-3 text-sm text-ink-secondary">
            {filtering ? (
              <>
                <span aria-live="polite">{t('matches', { shown: filtered.matchCount, total: tasks.length })}</span>
                <button
                  type="button"
                  onClick={() => setFilters(NO_FILTERS)}
                  className="text-action-primary hover:underline"
                >
                  {t('clearFilters')}
                </button>
              </>
            ) : (
              parentIds.length > 0 && (
                <>
                  <button type="button" onClick={rows.expandAll} className="hover:text-ink-primary hover:underline">
                    {t('expandAll')}
                  </button>
                  <button
                    type="button"
                    onClick={() => rows.collapseAll(parentIds)}
                    className="hover:text-ink-primary hover:underline"
                  >
                    {t('collapseAll')}
                  </button>
                </>
              )
            )}
          </div>
        </div>
      )}

      <Card className="mt-4">
        {isLoading ? null : tasks && tasks.length > 0 ? (
          filtered.tasks.length > 0 ? (
            group === 'STATUS' ? (
              groups.map((g) => (
                <section key={g.status} aria-label={tStatus(g.status)}>
                  <h3 className="border-b border-line bg-surface-subtle px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                    {tStatus(g.status)} <span className="font-normal text-ink-muted">· {g.tasks.length}</span>
                  </h3>
                  <TaskTree
                    tasks={g.tasks}
                    orgSlug={orgSlug}
                    projectKey={projectKey}
                    forceExpanded
                    collapsed={rows.collapsed}
                    onToggle={rows.toggle}
                  />
                </section>
              ))
            ) : (
              <TaskTree
                tasks={visible}
                orgSlug={orgSlug}
                projectKey={projectKey}
                forceExpanded={filtering}
                collapsed={rows.collapsed}
                onToggle={rows.toggle}
              />
            )
          ) : (
            <div className="p-6 text-center text-sm text-ink-secondary">
              <p>{t('noResults')}</p>
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="mt-2 text-action-primary hover:underline"
              >
                {t('clearFilters')}
              </button>
            </div>
          )
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>

      <CreateTaskModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ImportTasksModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

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
