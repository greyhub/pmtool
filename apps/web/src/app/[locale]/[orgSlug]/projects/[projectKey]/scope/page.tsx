'use client';

import { useParams } from 'next/navigation';
import { ScopeView } from '../../../../../../features/scope/scope-view';

export default function ScopePage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <ScopeView orgSlug={orgSlug} projectKey={projectKey} />;
}
