'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CreateOrganizationForm } from '../../../../features/organizations/create-organization-form';
import { JoinOrganizationForm } from '../../../../features/organizations/join-organization-form';
import { CenteredCardPage } from '../../../../components/centered-card-page';

export default function CreateOrganizationPage() {
  const t = useTranslations('onboarding');
  const [tab, setTab] = useState<'create' | 'join'>('create');

  return (
    <CenteredCardPage title={t('title')} subtitle={t('subtitle')} maxWidth="max-w-md">
      <div role="tablist" className="mb-6 flex gap-1 rounded-full bg-surface-subtle p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'create'}
          onClick={() => setTab('create')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'create'
              ? 'glass-field text-ink-primary'
              : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          {t('tabCreate')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'join'}
          onClick={() => setTab('join')}
          className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'join'
              ? 'glass-field text-ink-primary'
              : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          {t('tabJoin')}
        </button>
      </div>
      {tab === 'create' ? <CreateOrganizationForm /> : <JoinOrganizationForm />}
    </CenteredCardPage>
  );
}
