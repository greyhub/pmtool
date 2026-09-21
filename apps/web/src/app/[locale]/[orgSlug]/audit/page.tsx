'use client';

import { useParams } from 'next/navigation';
import { AuditView } from '../../../../features/history/history-view';

export default function AuditPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <AuditView orgSlug={orgSlug} />;
}
