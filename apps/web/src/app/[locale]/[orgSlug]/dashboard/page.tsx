'use client';

import { useParams } from 'next/navigation';
import { OrgDashboard } from '../../../../features/dashboard/org-dashboard';

export default function OrgDashboardPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <OrgDashboard orgSlug={orgSlug} />;
}
