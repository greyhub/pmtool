'use client';

import { useParams } from 'next/navigation';
import { StakeholderTable } from '../../../../../../features/stakeholders/stakeholder-table';

export default function StakeholdersPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <StakeholderTable orgSlug={orgSlug} projectKey={projectKey} />;
}
