'use client';

import { useTranslations } from 'next-intl';
import { SettingsShell } from '../../../features/settings/settings-shell';
import { TelegramCard } from '../../../features/settings/telegram-card';

export default function SettingsPage() {
  const t = useTranslations('settings');

  return (
    <SettingsShell title={t('title')}>
      <TelegramCard />
    </SettingsShell>
  );
}
