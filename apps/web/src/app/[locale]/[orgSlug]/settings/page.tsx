'use client';

import { useParams } from 'next/navigation';
import { OrgSettings } from '../../../../features/organizations/org-settings';

export default function OrgSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <OrgSettings orgSlug={orgSlug} />;
}
