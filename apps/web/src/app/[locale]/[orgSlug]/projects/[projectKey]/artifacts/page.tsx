'use client';

import { useParams } from 'next/navigation';
import { ArtifactList } from '../../../../../../features/artifacts/artifact-list';

export default function ArtifactsPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <ArtifactList orgSlug={orgSlug} projectKey={projectKey} />;
}
