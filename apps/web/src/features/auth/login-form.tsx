'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { loginSchema, LoginInput } from '@pmtool/shared-types';
import { useLogin, ApiError } from '@pmtool/api-client';
import { useRouter } from '../../i18n/navigation';

export function LoginForm() {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((data) => {
    login.mutate(data, {
      onSuccess: () => router.push('/onboarding/create-organization'),
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          autoComplete="current-password"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/30 dark:border-gray-600 dark:bg-gray-900"
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>

      {login.isError && (
        <p className="text-sm text-red-600">
          {login.error instanceof ApiError ? login.error.message : 'Có lỗi xảy ra'}
        </p>
      )}

      <button
        type="submit"
        disabled={login.isPending}
        className="mt-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-yellow-400 disabled:opacity-60"
      >
        {t('submit')}
      </button>
    </form>
  );
}
