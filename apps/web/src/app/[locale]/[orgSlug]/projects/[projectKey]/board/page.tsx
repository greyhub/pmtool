'use client';

import { useParams } from 'next/navigation';
import { KanbanBoardWidget } from '../../../../../../features/boards/kanban-board-widget';

export default function BoardPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <KanbanBoardWidget orgSlug={orgSlug} projectKey={projectKey} />;
}
