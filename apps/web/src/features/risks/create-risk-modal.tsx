'use client';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { createRiskIssueSchema, CreateRiskIssueInput } from '@pmtool/shared-types';
import { useCreateRiskIssue, useOrganizationMembers, ApiError } from '@pmtool/api-client';
import { Button, FormField, Input, Modal, Select } from '@pmtool/ui';

// The HTML date input yields a plain "YYYY-MM-DD" string, not the full
// RFC3339 datetime the API schema requires — loosen just that field here and
// convert to ISO before sending the request.
const riskFormSchema = createRiskIssueSchema.extend({ dueDate: z.string().optional() });
type RiskFormInput = z.infer<typeof riskFormSchema>;

export function CreateRiskModal({
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
  const t = useTranslations('risks.create');
  const tType = useTranslations('risks.type');
  const createRisk = useCreateRiskIssue(orgSlug, projectKey);
  const { data: members } = useOrganizationMembers(orgSlug);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RiskFormInput>({
    resolver: zodResolver(riskFormSchema),
    defaultValues: { type: 'RISK' },
  });

  const onSubmit = handleSubmit((data) => {
    const payload: CreateRiskIssueInput = {
      ...data,
      ownerId: data.ownerId || undefined,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
    };
    createRisk.mutate(payload, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  });

  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label={t('type')} htmlFor="risk-type">
          <Select id="risk-type" {...register('type')}>
            <option value="RISK">{tType('RISK')}</option>
            <option value="ISSUE">{tType('ISSUE')}</option>
          </Select>
        </FormField>

        <FormField label={t('titleLabel')} htmlFor="risk-title" error={errors.title?.message}>
          <Input id="risk-title" autoFocus invalid={!!errors.title} {...register('title')} />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('probability')} htmlFor="risk-probability" error={errors.probability?.message}>
            <Input
              id="risk-probability"
              type="number"
              min={1}
              max={5}
              {...register('probability', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
            />
          </FormField>
          <FormField label={t('impact')} htmlFor="risk-impact" error={errors.impact?.message}>
            <Input
              id="risk-impact"
              type="number"
              min={1}
              max={5}
              {...register('impact', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
            />
          </FormField>
        </div>

        <FormField label={t('owner')} htmlFor="risk-owner">
          <Select id="risk-owner" defaultValue="" {...register('ownerId')}>
            <option value="">{t('ownerNone')}</option>
            {(members ?? []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.fullName}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label={t('dueDate')} htmlFor="risk-due-date">
          <Input id="risk-due-date" type="date" {...register('dueDate')} />
        </FormField>

        {createRisk.isError && (
          <p role="alert" className="text-sm text-danger">
            {createRisk.error instanceof ApiError ? createRisk.error.message : 'Có lỗi xảy ra'}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={createRisk.isPending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
