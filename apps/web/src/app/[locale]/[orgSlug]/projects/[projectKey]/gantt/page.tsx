'use client';

import { useParams } from 'next/navigation';
import { GanttWidget } from '../../../../../../features/gantt/gantt-widget';

export default function GanttPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <GanttWidget orgSlug={orgSlug} projectKey={projectKey} />;
}
