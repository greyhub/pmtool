'use client';

import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '../../lib/cn';

export interface KanbanColumnProps {
  id: string;
  title: string;
  itemIds: string[];
  count: number;
  wipLimit?: number | null;
  headerExtra?: ReactNode;
  children: ReactNode;
}

export function KanbanColumn({ id, title, itemIds, count, wipLimit, headerExtra, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const overLimit = Boolean(wipLimit) && count > (wipLimit as number);

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-primary">{title}</h3>
          <span className={cn('text-xs', overLimit ? 'font-semibold text-danger' : 'text-ink-muted')}>
            {count}
            {wipLimit ? `/${wipLimit}` : ''}
          </span>
        </div>
        {headerExtra}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors',
          isOver ? 'border-action-primary bg-action-primary/5' : 'border-line-glass',
        )}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </div>
    </div>
  );
}
