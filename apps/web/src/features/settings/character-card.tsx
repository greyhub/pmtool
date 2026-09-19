'use client';

import { useTranslations } from 'next-intl';
import { MASCOT_CHARACTERS } from '@pmtool/shared-types';
import type { MascotCharacter } from '@pmtool/shared-types';
import { ApiError, useMe, useUpdatePreferences } from '@pmtool/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pmtool/ui';

export function CharacterCard() {
  const t = useTranslations('settings.character');
  const me = useMe();
  const updatePreferences = useUpdatePreferences();

  const current = me.data?.mascotCharacter;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {MASCOT_CHARACTERS.map((slug) => (
            <button
              key={slug}
              type="button"
              disabled={updatePreferences.isPending || !me.data}
              onClick={() => updatePreferences.mutate({ mascotCharacter: slug })}
              aria-pressed={current === slug}
              aria-label={t(`options.${slug}` as `options.${MascotCharacter}`)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                current === slug
                  ? 'border-action-primary ring-2 ring-action-primary'
                  : 'border-line hover:border-action-primary/50'
              }`}
            >
              <span
                aria-hidden="true"
                className="h-12 w-12 rounded-md bg-surface-subtle"
                style={{
                  backgroundImage: `url(/mascots/${slug}-directions.webp)`,
                  backgroundSize: '300% 300%',
                  backgroundPosition: '50% 50%',
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <span className="text-xs text-ink-secondary">{t(`options.${slug}` as `options.${MascotCharacter}`)}</span>
            </button>
          ))}
        </div>
        {updatePreferences.isError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {updatePreferences.error instanceof ApiError ? updatePreferences.error.message : t('conflictError')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
