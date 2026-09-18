'use client';

import { useTranslations } from 'next-intl';
import {
  useGenerateTelegramLinkCode,
  useTelegramStatus,
  useUnlinkTelegram,
  useUpdateTelegramDigestPreferences,
} from '@pmtool/api-client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select } from '@pmtool/ui';

export function TelegramCard() {
  const t = useTranslations('integrations.telegram');
  const status = useTelegramStatus();
  const generateCode = useGenerateTelegramLinkCode();
  const unlink = useUnlinkTelegram();
  const updateDigestPrefs = useUpdateTelegramDigestPreferences();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.isLoading ? null : status.data?.linked ? (
          <div className="flex flex-col gap-4">
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
            <div className="flex flex-col gap-3 border-t border-line-glass pt-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={status.data.dailyDigestEnabled}
                  disabled={updateDigestPrefs.isPending}
                  onChange={(e) =>
                    updateDigestPrefs.mutate({
                      dailyDigestEnabled: e.target.checked,
                      dailyDigestHour: status.data.dailyDigestHour,
                    })
                  }
                  className="h-4 w-4 shrink-0 accent-action-primary"
                />
                <span className="text-sm text-ink-primary">{t('digest.label')}</span>
              </label>
              {status.data.dailyDigestEnabled && (
                <div className="flex items-center justify-between gap-4 pl-7">
                  <span className="text-sm text-ink-secondary">{t('digest.hourLabel')}</span>
                  <Select
                    className="w-28"
                    value={status.data.dailyDigestHour}
                    disabled={updateDigestPrefs.isPending}
                    onChange={(e) =>
                      updateDigestPrefs.mutate({
                        dailyDigestEnabled: true,
                        dailyDigestHour: Number(e.target.value),
                      })
                    }
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
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
