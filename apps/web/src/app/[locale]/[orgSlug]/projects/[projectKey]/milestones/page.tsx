'use client';

import { useParams } from 'next/navigation';
import { MilestoneList } from '../../../../../../features/milestones/milestone-list';

export default function MilestonesPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <MilestoneList orgSlug={orgSlug} projectKey={projectKey} />;
}
