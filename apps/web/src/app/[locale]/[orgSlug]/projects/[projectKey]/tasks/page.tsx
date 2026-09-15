'use client';

import { useParams } from 'next/navigation';
import { TaskList } from '../../../../../../features/tasks/task-list';

export default function TasksPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <TaskList orgSlug={orgSlug} projectKey={projectKey} />;
}
