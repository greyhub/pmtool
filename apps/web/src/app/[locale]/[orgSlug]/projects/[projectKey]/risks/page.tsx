'use client';

import { useParams } from 'next/navigation';
import { RiskTable } from '../../../../../../features/risks/risk-table';

export default function RisksPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <RiskTable orgSlug={orgSlug} projectKey={projectKey} />;
}
