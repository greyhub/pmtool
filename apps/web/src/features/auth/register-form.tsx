'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { registerSchema, RegisterInput } from '@pmtool/shared-types';
import { useRegister, ApiError } from '@pmtool/api-client';
import { Button, FormField, Input } from '@pmtool/ui';
import { useRouter } from '../../i18n/navigation';

export function RegisterForm() {
  const t = useTranslations('auth.register');
  const router = useRouter();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data, {
      onSuccess: () => router.push('/onboarding/create-organization'),
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label={t('fullName')} htmlFor="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" invalid={!!errors.fullName} {...register('fullName')} />
      </FormField>

      <FormField label={t('email')} htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
      </FormField>

      <FormField label={t('password')} htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          {...register('password')}
        />
      </FormField>

      {registerMutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {registerMutation.error instanceof ApiError ? registerMutation.error.message : 'Có lỗi xảy ra'}
        </p>
      )}

      <Button type="submit" disabled={registerMutation.isPending} className="mt-2">
        {t('submit')}
      </Button>
    </form>
  );
}
