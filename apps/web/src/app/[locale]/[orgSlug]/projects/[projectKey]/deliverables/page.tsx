'use client';

import { useParams } from 'next/navigation';
import { DeliverableTable } from '../../../../../../features/deliverables/deliverable-table';

export default function DeliverablesPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <DeliverableTable orgSlug={orgSlug} projectKey={projectKey} />;
}
