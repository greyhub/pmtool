'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { createOrganizationSchema, CreateOrganizationInput } from '@pmtool/shared-types';
import { useCreateOrganization, ApiError } from '@pmtool/api-client';
import { useRouter } from '../../i18n/navigation';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateOrganizationForm() {
  const t = useTranslations('onboarding.createOrganization');
  const router = useRouter();
  const createOrganization = useCreateOrganization();
  const [slugTouched, setSlugTouched] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({ resolver: zodResolver(createOrganizationSchema) });

  const name = watch('name');

  const onSubmit = handleSubmit((data) => {
    createOrganization.mutate(data, {
      onSuccess: (org) => router.push(`/${org.slug}/dashboard`),
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('name')}
        </label>
        <input
          id="name"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 dark:border-gray-600 dark:bg-gray-900"
          {...register('name', {
            onChange: (e) => {
              if (!slugTouched) setValue('slug', slugify(e.target.value));
            },
          })}
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="slug" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('slug')}
        </label>
        <input
          id="slug"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 dark:border-gray-600 dark:bg-gray-900"
          {...register('slug', { onChange: () => setSlugTouched(true) })}
        />
        <p className="text-xs text-gray-400">{t('slugHint')}</p>
        {errors.slug && <p className="text-sm text-red-600">{errors.slug.message}</p>}
      </div>

      {createOrganization.isError && (
        <p className="text-sm text-red-600">
          {createOrganization.error instanceof ApiError ? createOrganization.error.message : 'Có lỗi xảy ra'}
        </p>
      )}

      <button
        type="submit"
        disabled={createOrganization.isPending || !name}
        className="mt-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-yellow-400 disabled:opacity-60"
      >
        {t('submit')}
      </button>
    </form>
  );
}
