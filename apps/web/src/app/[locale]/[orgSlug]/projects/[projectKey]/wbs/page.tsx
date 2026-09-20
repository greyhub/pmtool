'use client';

import { useParams } from 'next/navigation';
import { WbsView } from '../../../../../../features/wbs/wbs-view';

export default function WbsPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <WbsView orgSlug={orgSlug} projectKey={projectKey} />;
}
