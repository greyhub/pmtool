'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskDto } from '@pmtool/shared-types';
import { useBoardColumns, useCreateBoardColumn, useMoveTask, useTasks } from '@pmtool/api-client';
import { Avatar, Button, Input, KanbanBoard } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { TaskPriorityBadge } from '../tasks/task-badges';

const UNASSIGNED_COLUMN_ID = '__unassigned__';

function computeOrderIndex(columnItems: TaskDto[], toIndex: number, excludeId: string): number {
  const filtered = columnItems.filter((i) => i.id !== excludeId);
  const before = filtered[toIndex - 1];
  const after = filtered[toIndex];
  if (!before && !after) return 1000;
  if (!before) return after!.orderIndex - 1000;
  if (!after) return before.orderIndex + 1000;
  return (before.orderIndex + after.orderIndex) / 2;
}

export function KanbanBoardWidget({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('board');
  const { data: columns } = useBoardColumns(orgSlug, projectKey);
  const { data: tasks } = useTasks(orgSlug, projectKey);
  const moveTask = useMoveTask(orgSlug, projectKey);
  const createColumn = useCreateBoardColumn(orgSlug, projectKey);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  if (!columns || !tasks) return null;

  const topLevelTasks = tasks.filter((task) => !task.parentTaskId);
  const hasUnassigned = topLevelTasks.some((task) => !columns.some((c) => c.id === task.boardColumnId));

  const boardColumns = [
    ...(hasUnassigned ? [{ id: UNASSIGNED_COLUMN_ID, title: t('unassigned') }] : []),
    ...columns.map((c) => ({ id: c.id, title: c.name, wipLimit: c.wipLimit })),
  ];

  const items = topLevelTasks.map((task) => ({
    ...task,
    columnId: columns.some((c) => c.id === task.boardColumnId) ? task.boardColumnId! : UNASSIGNED_COLUMN_ID,
  }));

  const itemsByColumn = new Map<string, typeof items>();
  for (const col of boardColumns) itemsByColumn.set(col.id, []);
  for (const item of items) itemsByColumn.get(item.columnId)?.push(item);

  return (
    <div>
      <KanbanBoard
        columns={boardColumns}
        items={items}
        onMove={({ itemId, toColumnId, toIndex }) => {
          const destItems = itemsByColumn.get(toColumnId) ?? [];
          const orderIndex = computeOrderIndex(destItems, toIndex, itemId);
          moveTask.mutate({
            taskId: itemId,
            input: {
              boardColumnId: toColumnId === UNASSIGNED_COLUMN_ID ? null : toColumnId,
              orderIndex,
            },
          });
        }}
        renderCard={(task) => (
          <Link href={`/${orgSlug}/projects/${projectKey}/tasks/${task.id}`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-ink-muted">{task.humanKey}</span>
              <TaskPriorityBadge priority={task.priority} />
            </div>
            <p className="text-sm text-ink-primary">{task.title}</p>
            {task.assignees.length > 0 && (
              <div className="flex -space-x-2">
                {task.assignees.map((a) => (
                  <Avatar key={a.id} name={a.fullName} src={a.avatarUrl} size="sm" className="ring-2 ring-surface" />
                ))}
              </div>
            )}
          </Link>
        )}
      />

      <div className="mt-2">
        {addingColumn ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder={t('newColumnName')}
              className="w-48"
            />
            <Button
              size="sm"
              disabled={!newColumnName.trim() || createColumn.isPending}
              onClick={() => {
                createColumn.mutate(
                  { name: newColumnName.trim() },
                  { onSuccess: () => setNewColumnName('') },
                );
                setAddingColumn(false);
              }}
            >
              {t('addColumn')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)}>
              Hủy
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAddingColumn(true)}>
            + {t('addColumn')}
          </Button>
        )}
      </div>
    </div>
  );
}
