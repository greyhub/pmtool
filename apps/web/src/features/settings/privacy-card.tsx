'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useDeleteAccount, useExportMyData } from '@pmtool/api-client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Modal } from '@pmtool/ui';
import { Link, useRouter } from '../../i18n/navigation';
import { downloadJson } from '../../lib/download-json';

export function PrivacyCard() {
  const t = useTranslations('settings.privacy');
  const router = useRouter();
  const exportData = useExportMyData();
  const deleteAccount = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  function handleExport() {
    exportData.mutate(undefined, {
      onSuccess: (data) => downloadJson(`pmtool-du-lieu-cua-toi-${new Date().toISOString().slice(0, 10)}.json`, data),
    });
  }

  function handleDelete() {
    deleteAccount.mutate({ password }, { onSuccess: () => router.push('/') });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-sm text-ink-secondary">{t('exportHint')}</p>
          <Button variant="outline" size="sm" disabled={exportData.isPending} onClick={handleExport}>
            {t('export')}
          </Button>
        </div>
        {exportData.isError && (
          <p role="alert" className="text-sm text-danger">
            {exportData.error instanceof ApiError ? exportData.error.message : t('error')}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-glass pt-4">
          <p className="max-w-md text-sm text-ink-secondary">{t('deleteHint')}</p>
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            {t('delete')}
          </Button>
        </div>

        <p className="text-xs text-ink-muted">
          <Link href="/privacy" className="hover:underline">
            {t('privacyLink')}
          </Link>
          {' · '}
          <Link href="/terms" className="hover:underline">
            {t('termsLink')}
          </Link>
        </p>
      </CardContent>

      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false);
          setPassword('');
          deleteAccount.reset();
        }}
        title={t('confirmTitle')}
        description={t('confirmBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('cancel')}
            </Button>
            <Button variant="danger" disabled={!password || deleteAccount.isPending} onClick={handleDelete}>
              {t('confirmDelete')}
            </Button>
          </>
        }
      >
        <FormField label={t('password')} htmlFor="delete-password">
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {deleteAccount.isError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {deleteAccount.error instanceof ApiError ? deleteAccount.error.message : t('error')}
          </p>
        )}
      </Modal>
    </Card>
  );
}
