'use client';

import { useParams } from 'next/navigation';
import { ProjectList } from '../../../../features/projects/project-list';

export default function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <ProjectList orgSlug={orgSlug} />;
}
