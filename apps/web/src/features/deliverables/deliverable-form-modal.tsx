'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  useCreateDeliverable,
  useOrganizationMembers,
  useTasks,
  useUpdateDeliverable,
} from '@pmtool/api-client';
import type { DeliverableDto } from '@pmtool/shared-types';
import { Button, FormField, Input, Modal, Select } from '@pmtool/ui';
import { dateInputToIso, isoToDateInput } from '../../lib/date-input';

interface FormState {
  name: string;
  description: string;
  acceptanceCriteria: string;
  taskId: string;
  ownerId: string;
  dueDate: string;
  url: string;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  acceptanceCriteria: '',
  taskId: '',
  ownerId: '',
  dueDate: '',
  url: '',
};

const textareaClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus';

export function DeliverableFormModal({
  orgSlug,
  projectKey,
  open,
  editing,
  defaultTaskId,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  open: boolean;
  editing?: DeliverableDto;
  /** Pre-selects the linked task/milestone when creating (e.g. from a milestone row). */
  defaultTaskId?: string;
  onClose: () => void;
}) {
  const t = useTranslations('deliverables.form');
  const createDeliverable = useCreateDeliverable(orgSlug, projectKey);
  const updateDeliverable = useUpdateDeliverable(orgSlug, projectKey);
  const { data: members } = useOrganizationMembers(orgSlug);
  const { data: tasks } = useTasks(orgSlug, projectKey);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNameError(false);
    setForm(
      editing
        ? {
            name: editing.name,
            description: editing.description ?? '',
            acceptanceCriteria: editing.acceptanceCriteria ?? '',
            taskId: editing.taskId ?? '',
            ownerId: editing.ownerId ?? '',
            dueDate: isoToDateInput(editing.dueDate),
            url: editing.url ?? '',
          }
        : { ...EMPTY, taskId: defaultTaskId ?? '' },
    );
  }, [open, editing, defaultTaskId]);

  const mutation = editing ? updateDeliverable : createDeliverable;
  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Milestones first, then ordinary tasks — a deliverable most often belongs to a milestone.
  const linkable = [...(tasks ?? [])].sort((a, b) => Number(b.isMilestone) - Number(a.isMilestone));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    const dueDate = form.dueDate ? dateInputToIso(form.dueDate) : null;
    if (editing) {
      updateDeliverable.mutate(
        {
          deliverableId: editing.id,
          input: {
            name: form.name.trim(),
            description: form.description || null,
            acceptanceCriteria: form.acceptanceCriteria || null,
            taskId: form.taskId || null,
            ownerId: form.ownerId || null,
            dueDate,
            url: form.url || null,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      createDeliverable.mutate(
        {
          name: form.name.trim(),
          ...(form.description ? { description: form.description } : {}),
          ...(form.acceptanceCriteria ? { acceptanceCriteria: form.acceptanceCriteria } : {}),
          ...(form.taskId ? { taskId: form.taskId } : {}),
          ...(form.ownerId ? { ownerId: form.ownerId } : {}),
          ...(dueDate ? { dueDate } : {}),
          ...(form.url ? { url: form.url } : {}),
        },
        { onSuccess: onClose },
      );
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('editTitle') : t('createTitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormField label={t('name')} htmlFor="deliverable-name" error={nameError ? t('nameRequired') : undefined}>
          <Input id="deliverable-name" autoFocus invalid={nameError} value={form.name} onChange={set('name')} />
        </FormField>

        <FormField label={t('acceptanceCriteria')} htmlFor="deliverable-criteria" hint={t('acceptanceCriteriaHint')}>
          <textarea id="deliverable-criteria" rows={3} className={textareaClass} value={form.acceptanceCriteria} onChange={set('acceptanceCriteria')} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('task')} htmlFor="deliverable-task">
            <Select id="deliverable-task" value={form.taskId} onChange={set('taskId')}>
              <option value="">{t('taskNone')}</option>
              {linkable.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.isMilestone ? '◆ ' : ''}
                  {task.humanKey} — {task.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('dueDate')} htmlFor="deliverable-due">
            <Input id="deliverable-due" type="date" value={form.dueDate} onChange={set('dueDate')} />
          </FormField>
        </div>

        <FormField label={t('owner')} htmlFor="deliverable-owner">
          <Select id="deliverable-owner" value={form.ownerId} onChange={set('ownerId')}>
            <option value="">{t('ownerNone')}</option>
            {(members ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.fullName}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('url')} htmlFor="deliverable-url" hint={t('urlHint')}>
          <Input id="deliverable-url" value={form.url} onChange={set('url')} />
        </FormField>

        <FormField label={t('description')} htmlFor="deliverable-description">
          <textarea id="deliverable-description" rows={3} className={textareaClass} value={form.description} onChange={set('description')} />
        </FormField>

        {editing && (editing.status === 'SUBMITTED' || editing.status === 'ACCEPTED' || editing.status === 'REJECTED') && (
          <p className="text-xs text-ink-muted">{t('reopenWarning')}</p>
        )}

        {mutation.isError && (
          <p role="alert" className="text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : t('genericError')}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
