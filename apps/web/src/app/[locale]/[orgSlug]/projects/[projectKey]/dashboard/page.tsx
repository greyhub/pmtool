'use client';

import { useParams } from 'next/navigation';
import { ProjectDashboard } from '../../../../../../features/dashboard/project-dashboard';

export default function ProjectDashboardPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <ProjectDashboard orgSlug={orgSlug} projectKey={projectKey} />;
}
