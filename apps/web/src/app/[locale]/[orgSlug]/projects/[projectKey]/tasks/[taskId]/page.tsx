'use client';

import { useParams } from 'next/navigation';
import { TaskDetail } from '../../../../../../../features/tasks/task-detail';

export default function TaskDetailPage() {
  const { orgSlug, projectKey, taskId } = useParams<{ orgSlug: string; projectKey: string; taskId: string }>();
  return <TaskDetail orgSlug={orgSlug} projectKey={projectKey} taskId={taskId} />;
}
