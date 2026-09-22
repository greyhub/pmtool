'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { SettingsShell } from '../../../features/settings/settings-shell';
import { FeedbackView } from '../../../features/feedback/feedback-view';

export default function FeedbackPage() {
  const t = useTranslations('feedback');

  return (
    <SettingsShell title={t('title')}>
      <Suspense>
        <FeedbackView />
      </Suspense>
    </SettingsShell>
  );
}
