'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDeleteProjectDocument, useProjectDocuments } from '@pmtool/api-client';
import type { ProjectDocumentDto } from '@pmtool/shared-types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@pmtool/ui';
import { DocumentFormModal } from './document-form-modal';
import { usePermissions } from '../projects/use-permissions';

const STATUS_VARIANT = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  APPROVED: 'success',
  OBSOLETE: 'danger',
} as const;

export function DocumentTable({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('documents.list');
  const { canEdit } = usePermissions(orgSlug, projectKey);
  const tCategory = useTranslations('documents.category');
  const tStatus = useTranslations('documents.status');
  const { data: documents, isLoading } = useProjectDocuments(orgSlug, projectKey);
  const deleteDocument = useDeleteProjectDocument(orgSlug, projectKey);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDocumentDto | undefined>(undefined);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
          >
            {t('create')}
          </Button>
        )}
      </div>

      <Card className="mt-6">
        {isLoading ? null : documents && documents.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('columnTitle')}</TableHeaderCell>
                <TableHeaderCell>{t('columnCategory')}</TableHeaderCell>
                <TableHeaderCell>{t('columnVersion')}</TableHeaderCell>
                <TableHeaderCell>{t('columnStatus')}</TableHeaderCell>
                <TableHeaderCell>{t('columnOwner')}</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-ink-primary underline decoration-line-glass underline-offset-2 hover:text-action-primary"
                    >
                      {doc.title}
                    </a>
                  </TableCell>
                  <TableCell>{tCategory(doc.category)}</TableCell>
                  <TableCell className="font-mono text-xs">{doc.version}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[doc.status]}>{tStatus(doc.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    {doc.owner ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={doc.owner.fullName} size="sm" />
                        {doc.owner.fullName}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="row-actions flex justify-end gap-2">
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(doc);
                              setModalOpen(true);
                            }}
                          >
                            {t('edit')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteDocument.mutate(doc.id)}>
                            {t('delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>

      <DocumentFormModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
