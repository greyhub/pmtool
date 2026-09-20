'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { loginSchema, LoginInput, OrganizationDto } from '@pmtool/shared-types';
import { useLogin, ApiError, apiRequest } from '@pmtool/api-client';
import { Button, FormField, Input } from '@pmtool/ui';
import { Link, useRouter } from '../../i18n/navigation';
import { safeRedirectTarget } from '../../lib/post-auth-redirect';
import { GoogleButton } from './google-button';

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
      onSuccess: async () => {
        // Coming from a specific page (e.g. an invite link) — go back there
        // instead of the default landing, so the flow that sent the user to
        // log in actually gets to finish. Read directly from window instead
        // of useSearchParams() so this component doesn't force a Suspense
        // boundary on every page that renders it.
        const redirectTarget = safeRedirectTarget(new URLSearchParams(window.location.search).get('redirect'));
        if (redirectTarget) {
          router.push(redirectTarget);
          return;
        }

        // An account can already belong to organizations — only send them
        // to onboarding when they genuinely have none yet.
        const organizations = await apiRequest<OrganizationDto[]>('/api/v1/organizations').catch(
          () => [] as OrganizationDto[],
        );
        if (organizations.length > 0) {
          router.push(`/${organizations[0]!.slug}/dashboard`);
        } else {
          router.push('/onboarding/create-organization');
        }
      },
    });
  });

  const googleFailed =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('error') === 'google';

  return (
    <div className="flex flex-col gap-4">
      {googleFailed && (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {t('googleFailed')}
        </p>
      )}
      <GoogleButton label="signIn" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label={t('email')} htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} {...register('email')} />
        </FormField>

        <FormField label={t('password')} htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...register('password')}
          />
          <Link href="/forgot-password" className="mt-1 inline-block text-xs text-ink-secondary hover:underline">
            {t('forgotLink')}
          </Link>
        </FormField>

        {login.isError && (
          <p role="alert" className="text-sm text-danger">
            {login.error instanceof ApiError ? login.error.message : 'Có lỗi xảy ra'}
          </p>
        )}

        <Button type="submit" disabled={login.isPending} className="mt-2">
          {t('submit')}
        </Button>
      </form>
    </div>
  );
}
