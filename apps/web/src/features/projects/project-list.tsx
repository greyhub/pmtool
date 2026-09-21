'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjects } from '@pmtool/api-client';
import { Badge, Button, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { CreateProjectModal } from './create-project-modal';

const STATUS_VARIANT = {
  PLANNING: 'neutral',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'info',
  ARCHIVED: 'neutral',
} as const;

export function ProjectList({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('projects.list');
  const tStatus = useTranslations('projects.status');
  const tPrivate = useTranslations('projects.private');
  const { data: projects, isLoading } = useProjects(orgSlug);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>
      </div>

      <Card className="mt-6">
        {isLoading ? null : projects && projects.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Mã</TableHeaderCell>
                <TableHeaderCell>Tên dự án</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={`/${orgSlug}/projects/${project.key}/tasks`}
                      className="font-mono text-xs font-semibold text-ink-primary hover:underline"
                    >
                      {project.key}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/${orgSlug}/projects/${project.key}/tasks`} className="hover:underline">
                      {project.name}
                    </Link>
                    {project.isPrivate && (
                      <Badge variant="neutral" className="ml-2">
                        {tPrivate('badge')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[project.status]}>{tStatus(project.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>

      <CreateProjectModal orgSlug={orgSlug} open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
