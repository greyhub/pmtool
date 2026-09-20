'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { passwordSchema } from '@pmtool/shared-types';
import { ApiError, useResetPassword } from '@pmtool/api-client';
import { Button, FormField, Input } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth.reset');
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  if (reset.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-md bg-success-bg px-3 py-3 text-sm text-success">
          {t('done')}
        </p>
        <Link href="/login" className="text-center text-sm font-medium text-ink-primary hover:underline">
          {t('toLogin')}
        </Link>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setProblem(parsed.error.issues[0]?.message ?? t('weak'));
    if (password !== confirm) return setProblem(t('mismatch'));
    setProblem(null);
    reset.mutate({ token, password });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormField label={t('password')} htmlFor="new-password" hint={t('hint')}>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>
      <FormField label={t('confirm')} htmlFor="confirm-password">
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </FormField>
      {(problem || reset.isError) && (
        <p role="alert" className="text-sm text-danger">
          {problem ?? (reset.error instanceof ApiError ? reset.error.message : t('error'))}
        </p>
      )}
      <Button type="submit" disabled={reset.isPending} className="mt-2">
        {t('submit')}
      </Button>
    </form>
  );
}
