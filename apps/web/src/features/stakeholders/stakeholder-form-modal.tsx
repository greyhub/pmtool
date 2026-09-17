'use client';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createStakeholderSchema } from '@pmtool/shared-types';
import type { CreateStakeholderInput, StakeholderDto } from '@pmtool/shared-types';
import {
  ApiError,
  useCreateStakeholder,
  useOrganizationMembers,
  useUpdateStakeholder,
} from '@pmtool/api-client';
import { Button, FormField, Input, Modal, Select } from '@pmtool/ui';

// The HTML input always sends "" for an untouched optional field, but
// z.string().email().optional() only accepts undefined or a valid email —
// treat an empty string as "not provided" here, same fix used by the task
// dueDate field in create-risk-modal.tsx.
const formSchema = createStakeholderSchema.extend({
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
});
type FormInput = z.infer<typeof formSchema>;

const LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
const ENGAGEMENT_LEVELS = ['UNAWARE', 'RESISTANT', 'NEUTRAL', 'SUPPORTIVE', 'LEADING'] as const;

export function StakeholderFormModal({
  orgSlug,
  projectKey,
  open,
  editing,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  open: boolean;
  editing?: StakeholderDto;
  onClose: () => void;
}) {
  const t = useTranslations('stakeholders.form');
  const tLevel = useTranslations('stakeholders.level');
  const tEngagement = useTranslations('stakeholders.engagement');
  const createStakeholder = useCreateStakeholder(orgSlug, projectKey);
  const updateStakeholder = useUpdateStakeholder(orgSlug, projectKey);
  const { data: members } = useOrganizationMembers(orgSlug);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: 'INTERNAL',
      influence: 'MEDIUM',
      interest: 'MEDIUM',
      currentEngagement: 'NEUTRAL',
      desiredEngagement: 'SUPPORTIVE',
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            userId: editing.userId ?? undefined,
            fullName: editing.fullName,
            role: editing.role ?? undefined,
            organizationName: editing.organizationName ?? undefined,
            email: editing.email ?? undefined,
            phone: editing.phone ?? undefined,
            category: editing.category,
            influence: editing.influence,
            interest: editing.interest,
            currentEngagement: editing.currentEngagement,
            desiredEngagement: editing.desiredEngagement,
            notes: editing.notes ?? undefined,
          }
        : {
            category: 'INTERNAL',
            influence: 'MEDIUM',
            interest: 'MEDIUM',
            currentEngagement: 'NEUTRAL',
            desiredEngagement: 'SUPPORTIVE',
          },
    );
  }, [open, editing, reset]);

  const mutation = editing ? updateStakeholder : createStakeholder;

  const onSubmit = handleSubmit((data) => {
    const payload: CreateStakeholderInput = { ...data, userId: data.userId || undefined };
    if (editing) {
      updateStakeholder.mutate(
        { stakeholderId: editing.id, input: payload },
        { onSuccess: onClose },
      );
    } else {
      createStakeholder.mutate(payload, {
        onSuccess: () => {
          reset();
          onClose();
        },
      });
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('editTitle') : t('createTitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label={t('fullName')} htmlFor="stakeholder-name" error={errors.fullName?.message}>
          <Input id="stakeholder-name" autoFocus invalid={!!errors.fullName} {...register('fullName')} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('role')} htmlFor="stakeholder-role">
            <Input id="stakeholder-role" {...register('role')} />
          </FormField>
          <FormField label={t('organizationName')} htmlFor="stakeholder-org">
            <Input id="stakeholder-org" {...register('organizationName')} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('email')} htmlFor="stakeholder-email" error={errors.email?.message}>
            <Input id="stakeholder-email" type="email" {...register('email')} />
          </FormField>
          <FormField label={t('phone')} htmlFor="stakeholder-phone">
            <Input id="stakeholder-phone" {...register('phone')} />
          </FormField>
        </div>

        <FormField label={t('linkedUser')} htmlFor="stakeholder-user">
          <Select id="stakeholder-user" defaultValue="" {...register('userId')}>
            <option value="">{t('linkedUserNone')}</option>
            {(members ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.fullName}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('influence')} htmlFor="stakeholder-influence">
            <Select id="stakeholder-influence" {...register('influence')}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {tLevel(l)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('interest')} htmlFor="stakeholder-interest">
            <Select id="stakeholder-interest" {...register('interest')}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {tLevel(l)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('currentEngagement')} htmlFor="stakeholder-current-engagement">
            <Select id="stakeholder-current-engagement" {...register('currentEngagement')}>
              {ENGAGEMENT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {tEngagement(l)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('desiredEngagement')} htmlFor="stakeholder-desired-engagement">
            <Select id="stakeholder-desired-engagement" {...register('desiredEngagement')}>
              {ENGAGEMENT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {tEngagement(l)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label={t('notes')} htmlFor="stakeholder-notes">
          <textarea
            id="stakeholder-notes"
            rows={3}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
            {...register('notes')}
          />
        </FormField>

        {mutation.isError && (
          <p role="alert" className="text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : 'Có lỗi xảy ra'}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
