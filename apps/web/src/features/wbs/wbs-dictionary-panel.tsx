'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useSaveWbsDictionary, useWbsDictionary } from '@pmtool/api-client';
import type { TaskDto } from '@pmtool/shared-types';
import { Badge, Button, Card, FormField, Input } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';
import { NodeTypeBadge } from './node-type-badge';

const TEXTAREA_CLASS =
  'mt-0 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus';

const TEXT_FIELDS = ['scopeDescription', 'acceptanceCriteria', 'assumptions', 'constraints'] as const;
const LINE_FIELDS = ['requiredResources', 'qualityRequirements', 'technicalReferences'] as const;

interface FormState {
  scopeDescription: string;
  acceptanceCriteria: string;
  assumptions: string;
  constraints: string;
  requiredResources: string;
  qualityRequirements: string;
  technicalReferences: string;
  costEstimate: string;
}

const EMPTY: FormState = {
  scopeDescription: '',
  acceptanceCriteria: '',
  assumptions: '',
  constraints: '',
  requiredResources: '',
  qualityRequirements: '',
  technicalReferences: '',
  costEstimate: '',
};

/** The WBS dictionary entry of one task: the detail PMBOK keeps behind each WBS element. */
export function WbsDictionaryPanel({
  orgSlug,
  projectKey,
  task,
  code,
  hideOpenLink = false,
}: {
  orgSlug: string;
  projectKey: string;
  task: TaskDto;
  code: string;
  /** Set when the panel already sits on the task's own page. */
  hideOpenLink?: boolean;
}) {
  const t = useTranslations('wbs');
  const { data: entry, isLoading } = useWbsDictionary(orgSlug, projectKey, task.id);
  const save = useSaveWbsDictionary(orgSlug, projectKey, task.id);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    setForm({
      scopeDescription: entry?.scopeDescription ?? '',
      acceptanceCriteria: entry?.acceptanceCriteria ?? '',
      assumptions: entry?.assumptions ?? '',
      constraints: entry?.constraints ?? '',
      requiredResources: entry?.requiredResources ?? '',
      qualityRequirements: entry?.qualityRequirements ?? '',
      technicalReferences: entry?.technicalReferences ?? '',
      costEstimate: entry?.costEstimate != null ? String(entry.costEstimate) : '',
    });
  }, [entry, task.id]);

  const bind = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  function handleSave() {
    const cost = form.costEstimate.trim() === '' ? null : Number(form.costEstimate);
    save.mutate({
      scopeDescription: form.scopeDescription,
      acceptanceCriteria: form.acceptanceCriteria,
      assumptions: form.assumptions,
      constraints: form.constraints,
      requiredResources: form.requiredResources,
      qualityRequirements: form.qualityRequirements,
      technicalReferences: form.technicalReferences,
      costEstimate: cost !== null && Number.isFinite(cost) && cost >= 0 ? cost : null,
    });
  }

  const filled = Boolean(entry?.scopeDescription);

  return (
    <Card className="flex flex-col gap-4 p-5" data-testid="wbs-dictionary">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-ink-muted">{code}</span>
        <NodeTypeBadge type={task.nodeType} />
        <Badge variant={filled ? 'success' : 'warning'}>{filled ? t('filled') : t('missing')}</Badge>
      </div>
      <div>
        <h2 className="text-base font-semibold text-ink-primary">{task.title}</h2>
        <p className="text-sm text-ink-secondary">{t('dictionaryHint')}</p>
        {!hideOpenLink && (
          <Link
            href={`/${orgSlug}/projects/${projectKey}/tasks/${task.id}`}
            className="mt-1 inline-block text-sm text-action-primary hover:underline"
          >
            {t('openTask')} ({task.humanKey})
          </Link>
        )}
      </div>

      {isLoading ? null : (
        <>
          {TEXT_FIELDS.map((key) => (
            <FormField key={key} label={t(key)} htmlFor={`wbs-${key}`}>
              <textarea
                id={`wbs-${key}`}
                rows={key === 'scopeDescription' ? 4 : 3}
                className={TEXTAREA_CLASS}
                {...bind(key)}
              />
            </FormField>
          ))}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LINE_FIELDS.map((key) => (
              <FormField key={key} label={t(key)} htmlFor={`wbs-${key}`}>
                <Input id={`wbs-${key}`} {...bind(key)} />
              </FormField>
            ))}
            <FormField label={t('costEstimate')} htmlFor="wbs-costEstimate">
              <Input id="wbs-costEstimate" type="number" min={0} {...bind('costEstimate')} />
            </FormField>
          </div>
          {save.isError && (
            <p role="alert" className="text-sm text-danger">
              {save.error instanceof ApiError ? save.error.message : 'Có lỗi xảy ra'}
            </p>
          )}
          <div className="flex justify-end">
            <Button disabled={save.isPending} onClick={handleSave}>
              {t('save')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
