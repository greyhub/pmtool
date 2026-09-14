'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { createOrganizationSchema, CreateOrganizationInput } from '@pmtool/shared-types';
import { useCreateOrganization, ApiError } from '@pmtool/api-client';
import { Button, FormField, Input } from '@pmtool/ui';
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
      <FormField label={t('name')} htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          invalid={!!errors.name}
          {...register('name', {
            onChange: (e) => {
              if (!slugTouched) setValue('slug', slugify(e.target.value));
            },
          })}
        />
      </FormField>

      <FormField label={t('slug')} htmlFor="slug" hint={t('slugHint')} error={errors.slug?.message}>
        <Input id="slug" invalid={!!errors.slug} {...register('slug', { onChange: () => setSlugTouched(true) })} />
      </FormField>

      {createOrganization.isError && (
        <p role="alert" className="text-sm text-danger">
          {createOrganization.error instanceof ApiError ? createOrganization.error.message : 'Có lỗi xảy ra'}
        </p>
      )}

      <Button type="submit" disabled={createOrganization.isPending || !name} className="mt-2">
        {t('submit')}
      </Button>
    </form>
  );
}
