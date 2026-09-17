'use client';

import { useTranslations } from 'next-intl';
import { useArtifacts } from '@pmtool/api-client';
import { Card } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';

export function ArtifactList({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('artifacts.list');
  const { data: artifacts, isLoading } = useArtifacts(orgSlug, projectKey);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${orgSlug}/projects/${projectKey}/artifacts/new`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-action-primary px-4 text-sm font-semibold text-ink-on-primary transition-colors hover:bg-action-primary-hover"
        >
          {t('create')}
        </Link>
      </div>

      {isLoading ? null : artifacts && artifacts.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((artifact) => (
            <Link key={artifact.id} href={`/${orgSlug}/projects/${projectKey}/artifacts/${artifact.id}`}>
              <Card className="flex h-full flex-col gap-2 p-5 transition-shadow hover:shadow-xl">
                <h3 className="text-sm font-semibold text-ink-primary">{artifact.title}</h3>
                <p className="mt-auto text-xs text-ink-muted">
                  {t('updatedAt', { date: new Date(artifact.updatedAt).toLocaleString() })}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="mt-6 p-6">
          <p className="text-sm text-ink-secondary">{t('empty')}</p>
        </Card>
      )}
    </div>
  );
}
