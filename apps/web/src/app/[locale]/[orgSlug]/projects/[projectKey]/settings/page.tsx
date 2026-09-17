'use client';

import { useParams } from 'next/navigation';
import { ProjectSettings } from '../../../../../../features/projects/project-settings';

export default function ProjectSettingsPage() {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return <ProjectSettings orgSlug={orgSlug} projectKey={projectKey} />;
}
