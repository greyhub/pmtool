'use client';

import { useParams } from 'next/navigation';
import { CharterView } from '../../../../../../features/charter/charter-view';

export default function CharterPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <CharterView orgSlug={orgSlug} projectKey={projectKey} />;
}
