'use client';

import { useParams } from 'next/navigation';
import { ProjectShell } from '../../../../../features/projects/project-shell';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug, projectKey } = useParams<{ orgSlug: string; projectKey: string }>();
  return (
    <ProjectShell orgSlug={orgSlug} projectKey={projectKey}>
      {children}
    </ProjectShell>
  );
}
