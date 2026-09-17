'use client';

import { useTranslations } from 'next-intl';
import { useGenerateTelegramLinkCode, useTelegramStatus, useUnlinkTelegram } from '@pmtool/api-client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pmtool/ui';

export function TelegramCard() {
  const t = useTranslations('integrations.telegram');
  const status = useTelegramStatus();
  const generateCode = useGenerateTelegramLinkCode();
  const unlink = useUnlinkTelegram();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.isLoading ? null : status.data?.linked ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-success">{t('connected')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => unlink.mutate()}
              disabled={unlink.isPending}
            >
              {t('disconnect')}
            </Button>
          </div>
        ) : generateCode.data ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-secondary">{t('instructions')}</p>
            <a
              href={generateCode.data.deepLink}
              target="_blank"
              rel="noreferrer"
              className="break-all rounded-md border border-line-glass bg-surface-subtle p-3 text-sm font-mono text-ink-primary hover:bg-surface-subtle/80"
            >
              {generateCode.data.deepLink}
            </a>
            <p className="text-xs text-ink-muted">{t('codeExpires')}</p>
          </div>
        ) : (
          <Button
            onClick={() => generateCode.mutate()}
            disabled={generateCode.isPending || !status.data}
          >
            {t('connect')}
          </Button>
        )}
        {generateCode.isError && <p className="text-sm text-danger">{t('generateError')}</p>}
      </CardContent>
    </Card>
  );
}
