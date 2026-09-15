'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { createProjectSchema, CreateProjectInput } from '@pmtool/shared-types';
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
    createProject.mutate(data, {
      onSuccess: (project) => {
        reset();
        setKeyTouched(false);
        onClose();
        router.push(`/${orgSlug}/projects/${project.key}/tasks`);
      },
    });
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
          <Input id="project-key" invalid={!!errors.key} {...register('key', { onChange: () => setKeyTouched(true) })} />
        </FormField>

        <FormField label={t('description')} htmlFor="project-description" error={errors.description?.message}>
          <textarea
            id="project-description"
            rows={3}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
            {...register('description')}
          />
        </FormField>

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
