'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  useAcceptDeliverable,
  useDeleteDeliverable,
  useDeliverables,
  useRejectDeliverable,
  useSubmitDeliverable,
} from '@pmtool/api-client';
import type { DeliverableDto } from '@pmtool/shared-types';
import { Button, Card, Modal, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@pmtool/ui';
import { HistoryButton } from '../history/history-modal';
import { UserAvatar } from '../people/user-avatar';
import { Link } from '../../i18n/navigation';
import { formatDate } from '../../lib/date-input';
import { DeliverableFormModal } from './deliverable-form-modal';
import { DeliverableStatusBadge } from './deliverable-badges';
import { usePermissions } from '../projects/use-permissions';

export function DeliverableTable({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('deliverables.list');
  const { data: deliverables, isLoading } = useDeliverables(orgSlug, projectKey);
  const submit = useSubmitDeliverable(orgSlug, projectKey);
  const accept = useAcceptDeliverable(orgSlug, projectKey);
  const reject = useRejectDeliverable(orgSlug, projectKey);
  const remove = useDeleteDeliverable(orgSlug, projectKey);
  const { canEdit, canManage } = usePermissions(orgSlug, projectKey);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliverableDto | undefined>(undefined);
  const [rejecting, setRejecting] = useState<DeliverableDto | null>(null);
  const [reason, setReason] = useState('');

  // Sign-off is PM+ on the server; a non-PM's click comes back as an error we show inline
  // (the same approach the charter's Approve button takes).
  const actionError = [submit, accept, reject, remove].find((m) => m.isError)?.error;

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

      {actionError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {actionError instanceof ApiError ? actionError.message : t('genericError')}
        </p>
      )}

      <Card className="mt-6">
        {isLoading ? null : deliverables && deliverables.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('columnName')}</TableHeaderCell>
                <TableHeaderCell>{t('columnLink')}</TableHeaderCell>
                <TableHeaderCell>{t('columnStatus')}</TableHeaderCell>
                <TableHeaderCell>{t('columnOwner')}</TableHeaderCell>
                <TableHeaderCell>{t('columnDue')}</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deliverables.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="font-medium text-ink-primary">
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-line-glass underline-offset-2 hover:text-action-primary"
                        >
                          {d.name}
                        </a>
                      ) : (
                        d.name
                      )}
                    </div>
                    {d.acceptanceCriteria && (
                      <p className="mt-0.5 max-w-md truncate text-xs text-ink-muted" title={d.acceptanceCriteria}>
                        {t('criteriaPrefix')} {d.acceptanceCriteria}
                      </p>
                    )}
                    {d.status === 'REJECTED' && d.rejectionReason && (
                      <p className="mt-0.5 max-w-md text-xs text-danger">
                        {t('rejectedBecause')} {d.rejectionReason}
                      </p>
                    )}
                    {d.status === 'ACCEPTED' && d.reviewedBy && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {t('acceptedBy', { name: d.reviewedBy.fullName, date: formatDate(d.reviewedAt) })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.task ? (
                      <Link
                        href={`/${orgSlug}/projects/${projectKey}/tasks/${d.task.id}`}
                        className="text-sm hover:underline"
                      >
                        {d.task.isMilestone ? '◆ ' : ''}
                        {d.task.humanKey}
                      </Link>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DeliverableStatusBadge status={d.status} />
                  </TableCell>
                  <TableCell>
                    {d.owner ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar userId={d.owner.id} name={d.owner.fullName} />
                        {d.owner.fullName}
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(d.dueDate)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      {canEdit && (d.status === 'PLANNED' || d.status === 'IN_PROGRESS' || d.status === 'REJECTED') && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={submit.isPending}
                          onClick={() => submit.mutate(d.id)}
                        >
                          {t('submit')}
                        </Button>
                      )}
                      {canManage && d.status === 'SUBMITTED' && (
                        <>
                          <Button size="sm" variant="outline" disabled={accept.isPending} onClick={() => accept.mutate(d.id)}>
                            {t('accept')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReason('');
                              setRejecting(d);
                            }}
                          >
                            {t('reject')}
                          </Button>
                        </>
                      )}
                      <HistoryButton orgSlug={orgSlug} projectKey={projectKey} entityType="Deliverable" entityId={d.id} title={d.name} className="row-actions" />
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="row-actions"
                          onClick={() => {
                            setEditing(d);
                            setModalOpen(true);
                          }}
                        >
                          {t('edit')}
                        </Button>
                      )}
                      {canManage && (
                        <Button variant="ghost" size="sm" className="row-actions" onClick={() => remove.mutate(d.id)}>
                          {t('delete')}
                        </Button>
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

      <DeliverableFormModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
      />

      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={t('rejectTitle')}
        description={rejecting?.name}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setRejecting(null)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => {
                if (!rejecting) return;
                reject.mutate(
                  { deliverableId: rejecting.id, input: { reason: reason.trim() } },
                  { onSuccess: () => setRejecting(null) },
                );
              }}
            >
              {t('reject')}
            </Button>
          </>
        }
      >
        <label htmlFor="reject-reason" className="text-sm font-medium text-ink-secondary">
          {t('rejectReason')}
        </label>
        <textarea
          id="reject-reason"
          rows={3}
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </Modal>
    </div>
  );
}
