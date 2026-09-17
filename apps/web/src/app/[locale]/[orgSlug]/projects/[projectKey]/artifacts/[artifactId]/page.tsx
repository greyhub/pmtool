'use client';

import { useParams } from 'next/navigation';
import { ArtifactEditor } from '../../../../../../../features/artifacts/artifact-editor';

export default function ArtifactDetailPage() {
  const { orgSlug, projectKey, artifactId } = useParams<{
    orgSlug: string;
    projectKey: string;
    artifactId: string;
  }>();
  return <ArtifactEditor orgSlug={orgSlug} projectKey={projectKey} artifactId={artifactId} />;
}
