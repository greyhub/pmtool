'use client';

import { useTranslations } from 'next-intl';
import { SettingsShell } from '../../../features/settings/settings-shell';
import { TelegramCard } from '../../../features/settings/telegram-card';
import { CharacterCard } from '../../../features/settings/character-card';

export default function SettingsPage() {
  const t = useTranslations('settings');

  return (
    <SettingsShell title={t('title')}>
      <div className="flex flex-col gap-6">
        <CharacterCard />
        <TelegramCard />
      </div>
    </SettingsShell>
  );
}
