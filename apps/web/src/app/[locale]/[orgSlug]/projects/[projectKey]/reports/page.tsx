'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { DailyReportView } from '../../../../../../features/reports/daily-report-view';

export default function ReportsPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return (
    <Suspense fallback={null}>
      <DailyReportView orgSlug={orgSlug} projectKey={projectKey} />
    </Suspense>
  );
}
