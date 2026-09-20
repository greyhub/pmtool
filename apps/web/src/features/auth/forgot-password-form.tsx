'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { forgotPasswordSchema, ForgotPasswordInput } from '@pmtool/shared-types';
import { ApiError, useForgotPassword } from '@pmtool/api-client';
import { Button, FormField, Input } from '@pmtool/ui';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgot');
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  if (forgot.isSuccess) {
    return (
      <p role="status" className="rounded-md bg-success-bg px-3 py-3 text-sm text-success">
        {t('sent')}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => forgot.mutate(data))} className="flex flex-col gap-4">
      <FormField label={t('email')} htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
      </FormField>
      {forgot.isError && (
        <p role="alert" className="text-sm text-danger">
          {forgot.error instanceof ApiError ? forgot.error.message : t('error')}
        </p>
      )}
      <Button type="submit" disabled={forgot.isPending} className="mt-2">
        {t('submit')}
      </Button>
    </form>
  );
}
