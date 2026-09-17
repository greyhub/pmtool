'use client';

import { useParams } from 'next/navigation';
import { DocumentTable } from '../../../../../../features/documents/document-table';

export default function DocumentsPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <DocumentTable orgSlug={orgSlug} projectKey={projectKey} />;
}
