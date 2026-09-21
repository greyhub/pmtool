'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectHistory } from '@pmtool/api-client';
import { Button, Modal } from '@pmtool/ui';
import { HistoryList } from './history-list';

/** The change history of one item (its own changes and those filed under it, like a task's assignees). */
export function HistoryModal({
  orgSlug,
  projectKey,
  entityType,
  entityId,
  title,
  open,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  entityType: string;
  entityId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('history');
  const query = useProjectHistory(orgSlug, projectKey, { entityType, entityId }, open);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('modalTitle', { name: title })}
      className="max-w-2xl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('close')}
        </Button>
      }
    >
      <HistoryList orgSlug={orgSlug} query={query} emptyText={t('emptyEntity')} />
    </Modal>
  );
}

/** A small "History" button that opens the item's change history. */
export function HistoryButton({
  orgSlug,
  projectKey,
  entityType,
  entityId,
  title,
  className,
  variant = 'ghost',
}: {
  orgSlug: string;
  projectKey: string;
  entityType: string;
  entityId: string;
  title: string;
  className?: string;
  variant?: 'ghost' | 'outline';
}) {
  const t = useTranslations('history');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={t('openFor', { name: title })}
      >
        {t('button')}
      </Button>
      {open && (
        <HistoryModal
          orgSlug={orgSlug}
          projectKey={projectKey}
          entityType={entityType}
          entityId={entityId}
          title={title}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
