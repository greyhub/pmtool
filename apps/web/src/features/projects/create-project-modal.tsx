'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { createProjectSchema, CreateProjectInput, PROJECT_TEMPLATES, templateStats } from '@pmtool/shared-types';
import { useCreateProject, ApiError } from '@pmtool/api-client';
import { Button, FormField, Input, Modal } from '@pmtool/ui';
import { useRouter } from '../../i18n/navigation';

function slugifyKey(value: string): string {
  return value
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export function CreateProjectModal({
  orgSlug,
  open,
  onClose,
}: {
  orgSlug: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('projects.create');
  const router = useRouter();
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  const [templateId, setTemplateId] = useState<CreateProjectInput['templateId']>(undefined);
  const createProject = useCreateProject(orgSlug);
  const [keyTouched, setKeyTouched] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateProjectInput>({ resolver: zodResolver(createProjectSchema) });

  const onSubmit = handleSubmit((data) => {
    createProject.mutate(
      { ...data, templateId, locale },
      {
        onSuccess: (project) => {
          reset();
          setKeyTouched(false);
          setTemplateId(undefined);
          onClose();
          router.push(`/${orgSlug}/projects/${project.key}/tasks`);
        },
      },
    );
  });

  return (
    <Modal open={open} onClose={onClose} title={t('title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label={t('name')} htmlFor="project-name" error={errors.name?.message}>
          <Input
            id="project-name"
            invalid={!!errors.name}
            {...register('name', {
              onChange: (e) => {
                if (!keyTouched) setValue('key', slugifyKey(e.target.value));
              },
            })}
          />
        </FormField>

        <FormField label={t('key')} htmlFor="project-key" hint={t('keyHint')} error={errors.key?.message}>
          <Input
            id="project-key"
            invalid={!!errors.key}
            {...register('key', { onChange: () => setKeyTouched(true) })}
          />
        </FormField>

        <FormField label={t('description')} htmlFor="project-description" error={errors.description?.message}>
          <textarea
            id="project-description"
            rows={3}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
            {...register('description')}
          />
        </FormField>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink-primary">{t('startFrom')}</legend>
          <div role="radiogroup" aria-label={t('startFrom')} className="grid grid-cols-1 gap-2">
            {[undefined, ...PROJECT_TEMPLATES].map((tpl) => {
              const selected = (tpl?.id ?? undefined) === templateId;
              const stats = tpl ? templateStats(tpl) : null;
              return (
                <button
                  key={tpl?.id ?? 'blank'}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTemplateId(tpl?.id as CreateProjectInput['templateId'])}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-action-primary bg-action-primary/10 ring-1 ring-action-primary'
                      : 'border-line hover:border-action-primary/50'
                  }`}
                >
                  <span className="block text-sm font-medium text-ink-primary">
                    {tpl ? tpl.name[locale] : t('blank')}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-secondary">
                    {tpl ? tpl.description[locale] : t('blankHint')}
                  </span>
                  {stats && (
                    <span className="mt-1 block text-xs text-ink-muted">
                      {t('stats', {
                        phases: stats.phases,
                        deliverables: stats.deliverables,
                        workPackages: stats.workPackages,
                        activities: stats.activities,
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {createProject.isError && (
          <p role="alert" className="text-sm text-danger">
            {createProject.error instanceof ApiError ? createProject.error.message : 'Có lỗi xảy ra'}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={createProject.isPending}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
