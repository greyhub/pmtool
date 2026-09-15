'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';

export interface KanbanBoardItem {
  id: string;
  columnId: string;
}

export interface KanbanBoardColumnDef {
  id: string;
  title: string;
  wipLimit?: number | null;
  headerExtra?: ReactNode;
}

export interface KanbanBoardProps<T extends KanbanBoardItem> {
  columns: KanbanBoardColumnDef[];
  /** Pre-sorted (e.g. by orderIndex) — the board renders items within a column in the order given here. */
  items: T[];
  renderCard: (item: T) => ReactNode;
  onMove: (params: { itemId: string; toColumnId: string; toIndex: number }) => void;
}

export function KanbanBoard<T extends KanbanBoardItem>({ columns, items, renderCard, onMove }: KanbanBoardProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const itemsByColumn = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const column of columns) map.set(column.id, []);
    for (const item of items) {
      const bucket = map.get(item.columnId);
      if (bucket) bucket.push(item);
    }
    return map;
  }, [columns, items]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeItem = itemById.get(String(active.id));
    if (!activeItem) return;

    const overId = String(over.id);
    const overIsColumn = columns.some((c) => c.id === overId);
    const toColumnId = overIsColumn ? overId : (itemById.get(overId)?.columnId ?? activeItem.columnId);
    const destItems = itemsByColumn.get(toColumnId) ?? [];
    const toIndex = overIsColumn ? destItems.length : destItems.findIndex((i) => i.id === overId);

    if (toColumnId === activeItem.columnId && toIndex === destItems.findIndex((i) => i.id === activeItem.id)) {
      return; // dropped back in the same spot
    }

    onMove({ itemId: activeItem.id, toColumnId, toIndex: toIndex < 0 ? destItems.length : toIndex });
  }

  const activeItem = activeId ? itemById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => {
          const columnItems = itemsByColumn.get(column.id) ?? [];
          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              itemIds={columnItems.map((i) => i.id)}
              count={columnItems.length}
              wipLimit={column.wipLimit}
              headerExtra={column.headerExtra}
            >
              {columnItems.map((item) => (
                <KanbanCard key={item.id} id={item.id}>
                  {renderCard(item)}
                </KanbanCard>
              ))}
            </KanbanColumn>
          );
        })}
      </div>
      <DragOverlay>{activeItem ? renderCard(activeItem) : null}</DragOverlay>
    </DndContext>
  );
}
