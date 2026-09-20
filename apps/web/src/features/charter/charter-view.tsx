'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useApproveCharter, useCharter, useOrganizationMembers, useUpsertCharter, ApiError } from '@pmtool/api-client';
import { Badge, Button, Card, FormField, Input, Select } from '@pmtool/ui';
import { usePermissions } from '../projects/use-permissions';

const TEXTAREA_CLASS =
  'mt-0 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus';

interface FormState {
  purpose: string;
  objectives: string;
  scopeSummary: string;
  milestonesSummary: string;
  budgetSummary: string;
  assumptions: string;
  constraints: string;
  sponsorName: string;
  projectManagerId: string;
}

const EMPTY_FORM: FormState = {
  purpose: '',
  objectives: '',
  scopeSummary: '',
  milestonesSummary: '',
  budgetSummary: '',
  assumptions: '',
  constraints: '',
  sponsorName: '',
  projectManagerId: '',
};

export function CharterView({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('charter');
  const { data: charter, isLoading } = useCharter(orgSlug, projectKey);
  const { data: members } = useOrganizationMembers(orgSlug);
  const upsertCharter = useUpsertCharter(orgSlug, projectKey);
  const approveCharter = useApproveCharter(orgSlug, projectKey);
  const { canManage, canSponsor } = usePermissions(orgSlug, projectKey);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    if (!charter) return;
    setForm({
      purpose: charter.purpose ?? '',
      objectives: charter.objectives ?? '',
      scopeSummary: charter.scopeSummary ?? '',
      milestonesSummary: charter.milestonesSummary ?? '',
      budgetSummary: charter.budgetSummary ?? '',
      assumptions: charter.assumptions ?? '',
      constraints: charter.constraints ?? '',
      sponsorName: charter.sponsorName ?? '',
      projectManagerId: charter.projectManagerId ?? '',
    });
  }, [charter]);

  if (isLoading) return null;

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  function handleSave() {
    upsertCharter.mutate({
      purpose: form.purpose,
      objectives: form.objectives,
      scopeSummary: form.scopeSummary,
      milestonesSummary: form.milestonesSummary,
      budgetSummary: form.budgetSummary,
      assumptions: form.assumptions,
      constraints: form.constraints,
      sponsorName: form.sponsorName,
      projectManagerId: form.projectManagerId || undefined,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {charter?.status === 'APPROVED' ? (
            <Badge variant="success">{t('approved')}</Badge>
          ) : (
            <Badge variant="neutral">{t('draft')}</Badge>
          )}
        </div>
      </div>

      {charter?.status === 'APPROVED' && charter.approvedBy && charter.approvedAt && (
        <Card className="mt-4 p-4 text-sm text-ink-secondary">
          {t('approvedBanner', {
            name: charter.approvedBy.fullName,
            date: new Date(charter.approvedAt).toLocaleDateString(),
          })}
        </Card>
      )}

      <Card className="mt-6 p-6">
        <fieldset disabled={!canManage} className="flex min-w-0 flex-col gap-5 border-0 p-0">
          <FormField label={t('purpose')} htmlFor="charter-purpose" hint={t('purposeHint')}>
            <textarea id="charter-purpose" rows={4} className={TEXTAREA_CLASS} {...field('purpose')} />
          </FormField>

          <FormField label={t('objectives')} htmlFor="charter-objectives" hint={t('objectivesHint')}>
            <textarea id="charter-objectives" rows={4} className={TEXTAREA_CLASS} {...field('objectives')} />
          </FormField>

          <FormField label={t('scopeSummary')} htmlFor="charter-scope" hint={t('scopeSummaryHint')}>
            <textarea id="charter-scope" rows={4} className={TEXTAREA_CLASS} {...field('scopeSummary')} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('milestonesSummary')} htmlFor="charter-milestones">
              <textarea id="charter-milestones" rows={3} className={TEXTAREA_CLASS} {...field('milestonesSummary')} />
            </FormField>
            <FormField label={t('budgetSummary')} htmlFor="charter-budget">
              <Input id="charter-budget" {...field('budgetSummary')} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('assumptions')} htmlFor="charter-assumptions">
              <textarea id="charter-assumptions" rows={3} className={TEXTAREA_CLASS} {...field('assumptions')} />
            </FormField>
            <FormField label={t('constraints')} htmlFor="charter-constraints">
              <textarea id="charter-constraints" rows={3} className={TEXTAREA_CLASS} {...field('constraints')} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('sponsorName')} htmlFor="charter-sponsor">
              <Input id="charter-sponsor" {...field('sponsorName')} />
            </FormField>
            <FormField label={t('projectManager')} htmlFor="charter-pm">
              <Select id="charter-pm" {...field('projectManagerId')}>
                <option value="">{t('projectManagerNone')}</option>
                {(members ?? []).map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {(upsertCharter.isError || approveCharter.isError) && (
            <p role="alert" className="text-sm text-danger">
              {(upsertCharter.error ?? approveCharter.error) instanceof ApiError
                ? (upsertCharter.error ?? approveCharter.error)?.message
                : 'Có lỗi xảy ra'}
            </p>
          )}

          {canManage && (
            <div className="flex justify-end gap-3">
              {canSponsor && charter?.status === 'DRAFT' && (
                <Button variant="outline" disabled={approveCharter.isPending} onClick={() => approveCharter.mutate()}>
                  {t('approve')}
                </Button>
              )}
              <Button disabled={upsertCharter.isPending} onClick={handleSave}>
                {t('save')}
              </Button>
            </div>
          )}
        </fieldset>
      </Card>
    </div>
  );
}
