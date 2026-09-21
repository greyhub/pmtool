'use client';

import { useParams } from 'next/navigation';
import { ProjectHistoryView } from '../../../../../../features/history/history-view';

export default function ProjectHistoryPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <ProjectHistoryView orgSlug={orgSlug} projectKey={projectKey} />;
}
