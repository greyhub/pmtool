'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { registerSchema, RegisterInput } from '@pmtool/shared-types';
import { useRegister, ApiError } from '@pmtool/api-client';
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
      <div className="flex flex-col gap-1">
        <label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('fullName')}
        </label>
        <input
          id="fullName"
          autoComplete="name"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 dark:border-gray-600 dark:bg-gray-900"
          {...register('fullName')}
        />
        {errors.fullName && <p className="text-sm text-red-600">{errors.fullName.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 dark:border-gray-600 dark:bg-gray-900"
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('password')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 dark:border-gray-600 dark:bg-gray-900"
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {registerMutation.isError && (
        <p className="text-sm text-red-600">
          {registerMutation.error instanceof ApiError ? registerMutation.error.message : 'Có lỗi xảy ra'}
        </p>
      )}

      <button
        type="submit"
        disabled={registerMutation.isPending}
        className="mt-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-yellow-400 disabled:opacity-60"
      >
        {t('submit')}
      </button>
    </form>
  );
}
