'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useApproveScope, useProjectScope, useSaveScope } from '@pmtool/api-client';
import { Badge, Button, Card, FormField } from '@pmtool/ui';
import { usePermissions } from '../projects/use-permissions';

const TEXTAREA_CLASS =
  'mt-0 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus';

const FIELDS = [
  'inScope',
  'outOfScope',
  'deliverablesSummary',
  'acceptanceCriteria',
  'assumptions',
  'constraints',
] as const;
type FieldKey = (typeof FIELDS)[number];
const EMPTY = Object.fromEntries(FIELDS.map((k) => [k, ''])) as Record<FieldKey, string>;

export function ScopeView({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('scope');
  const { data: scope, isLoading } = useProjectScope(orgSlug, projectKey);
  const save = useSaveScope(orgSlug, projectKey);
  const { canManage, canSponsor } = usePermissions(orgSlug, projectKey);
  const approve = useApproveScope(orgSlug, projectKey);
  const [form, setForm] = useState<Record<FieldKey, string>>(EMPTY);

  useEffect(() => {
    if (!scope) return;
    setForm(Object.fromEntries(FIELDS.map((k) => [k, scope[k] ?? ''])) as Record<FieldKey, string>);
  }, [scope]);

  if (isLoading) return null;

  const bind = (key: FieldKey) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });
  const error = save.error ?? approve.error;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <Badge variant={scope?.status === 'APPROVED' ? 'success' : 'neutral'}>
          {scope?.status === 'APPROVED' ? t('approved') : t('draft')}
        </Badge>
      </div>

      {scope?.status === 'APPROVED' && scope.approvedAt && (
        <Card className="mt-4 p-4 text-sm text-ink-secondary">
          {t('approvedBanner', {
            name: scope.approvedByName ?? '—',
            date: new Date(scope.approvedAt).toLocaleDateString(),
          })}
        </Card>
      )}

      <Card className="mt-6 p-6">
        <fieldset disabled={!canManage} className="flex min-w-0 flex-col gap-5 border-0 p-0">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={t('inScope')} htmlFor="scope-in" hint={t('inScopeHint')}>
              <textarea id="scope-in" rows={5} className={TEXTAREA_CLASS} {...bind('inScope')} />
            </FormField>
            <FormField label={t('outOfScope')} htmlFor="scope-out" hint={t('outOfScopeHint')}>
              <textarea id="scope-out" rows={5} className={TEXTAREA_CLASS} {...bind('outOfScope')} />
            </FormField>
          </div>
          <FormField label={t('deliverablesSummary')} htmlFor="scope-deliverables" hint={t('deliverablesSummaryHint')}>
            <textarea id="scope-deliverables" rows={4} className={TEXTAREA_CLASS} {...bind('deliverablesSummary')} />
          </FormField>
          <FormField label={t('acceptanceCriteria')} htmlFor="scope-criteria">
            <textarea id="scope-criteria" rows={4} className={TEXTAREA_CLASS} {...bind('acceptanceCriteria')} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label={t('assumptions')} htmlFor="scope-assumptions">
              <textarea id="scope-assumptions" rows={3} className={TEXTAREA_CLASS} {...bind('assumptions')} />
            </FormField>
            <FormField label={t('constraints')} htmlFor="scope-constraints">
              <textarea id="scope-constraints" rows={3} className={TEXTAREA_CLASS} {...bind('constraints')} />
            </FormField>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error instanceof ApiError ? error.message : 'Có lỗi xảy ra'}
            </p>
          )}

          {canManage && (
            <div className="flex justify-end gap-3">
              {canSponsor && scope?.status === 'DRAFT' && (
                <Button variant="outline" disabled={approve.isPending} onClick={() => approve.mutate()}>
                  {t('approve')}
                </Button>
              )}
              <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
                {t('save')}
              </Button>
            </div>
          )}
        </fieldset>
      </Card>
    </div>
  );
}
