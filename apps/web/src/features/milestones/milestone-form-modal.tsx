'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useCreateTask, useOrganizationMembers } from '@pmtool/api-client';
import { Button, FormField, Input, Modal, Select } from '@pmtool/ui';
import { dateInputToIso } from '../../lib/date-input';

export function MilestoneFormModal({
  orgSlug,
  projectKey,
  open,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('milestones.form');
  const createTask = useCreateTask(orgSlug, projectKey);
  const { data: members } = useOrganizationMembers(orgSlug);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [invalid, setInvalid] = useState<{ title?: boolean; dueDate?: boolean }>({});

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDueDate('');
    setAssigneeId('');
    setInvalid({});
    createTask.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { title: !title.trim(), dueDate: !dueDate };
    setInvalid(next);
    if (next.title || next.dueDate) return;
    createTask.mutate(
      {
        title: title.trim(),
        isMilestone: true,
        dueDate: dateInputToIso(dueDate),
        ...(assigneeId ? { assigneeId } : {}),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={t('title')} description={t('hint')}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormField label={t('name')} htmlFor="milestone-title" error={invalid.title ? t('nameRequired') : undefined}>
          <Input id="milestone-title" autoFocus invalid={!!invalid.title} value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label={t('dueDate')} htmlFor="milestone-due" error={invalid.dueDate ? t('dueRequired') : undefined}>
          <Input id="milestone-due" type="date" invalid={!!invalid.dueDate} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormField>
        <FormField label={t('assignee')} htmlFor="milestone-assignee">
          <Select id="milestone-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">{t('assigneeNone')}</option>
            {(members ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.fullName}
              </option>
            ))}
          </Select>
        </FormField>

        {createTask.isError && (
          <p role="alert" className="text-sm text-danger">
            {createTask.error instanceof ApiError ? createTask.error.message : t('genericError')}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={createTask.isPending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
