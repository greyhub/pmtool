'use client';

import { useParams } from 'next/navigation';
import { SprintsView } from '../../../../../../features/sprints/sprints-view';

export default function SprintsPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <SprintsView orgSlug={orgSlug} projectKey={projectKey} />;
}
