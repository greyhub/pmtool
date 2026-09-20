'use client';

import { useParams } from 'next/navigation';
import { MyTasksView } from '../../../../features/tasks/my-tasks-view';

export default function MyTasksPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <MyTasksView orgSlug={orgSlug} />;
}
