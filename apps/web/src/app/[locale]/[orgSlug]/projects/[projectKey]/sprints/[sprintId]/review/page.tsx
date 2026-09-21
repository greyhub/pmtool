'use client';

import { useParams } from 'next/navigation';
import { SprintReviewView } from '../../../../../../../../features/sprints/sprint-review-view';

export default function SprintReviewPage() {
  const { orgSlug, projectKey, sprintId } = useParams<{ orgSlug: string; projectKey: string; sprintId: string }>();
  return <SprintReviewView orgSlug={orgSlug} projectKey={projectKey} sprintId={sprintId} />;
}
