'use client';

import { useParams } from 'next/navigation';
import { ArtifactEditor } from '../../../../../../../features/artifacts/artifact-editor';

export default function NewArtifactPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <ArtifactEditor orgSlug={orgSlug} projectKey={projectKey} />;
}
