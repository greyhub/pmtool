'use client';

import { useTranslations } from 'next-intl';
import { MASCOT_CHARACTERS } from '@pmtool/shared-types';
import type { MascotCharacter } from '@pmtool/shared-types';
import { ApiError, useMe, useTakenCharacters, useUpdatePreferences } from '@pmtool/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@pmtool/ui';

export function CharacterCard() {
  const t = useTranslations('settings.character');
  const me = useMe();
  const updatePreferences = useUpdatePreferences();
  const { data: takenList } = useTakenCharacters();
  const taken = new Map((takenList ?? []).map((x) => [x.character, x.takenBy]));

  const current = me.data?.mascotCharacter;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {MASCOT_CHARACTERS.map((slug) => {
            const takenBy = taken.get(slug);
            const isCurrent = current === slug;
            const unavailable = Boolean(takenBy) && !isCurrent;
            const name = t(`options.${slug}` as `options.${MascotCharacter}`);
            return (
              <button
                key={slug}
                type="button"
                disabled={updatePreferences.isPending || !me.data || unavailable}
                onClick={() => updatePreferences.mutate({ mascotCharacter: slug })}
                aria-pressed={isCurrent}
                aria-label={unavailable ? `${name} — ${t('takenBy', { name: takenBy ?? '' })}` : name}
                title={unavailable ? t('takenBy', { name: takenBy ?? '' }) : undefined}
                className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                  isCurrent
                    ? 'border-action-primary ring-2 ring-action-primary'
                    : unavailable
                      ? 'cursor-not-allowed border-line opacity-50'
                      : 'border-line hover:border-action-primary/50'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-12 w-12 rounded-md bg-surface-subtle ${unavailable ? 'grayscale' : ''}`}
                  style={{
                    backgroundImage: `url(/mascots/${slug}-directions.webp)`,
                    backgroundSize: '300% 300%',
                    backgroundPosition: '50% 50%',
                    backgroundRepeat: 'no-repeat',
                  }}
                />
                <span className="text-xs text-ink-secondary">{name}</span>
                {isCurrent && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-action-primary px-1.5 py-0.5 text-[10px] font-semibold text-ink-on-primary">
                    ✓ {t('current')}
                  </span>
                )}
                {unavailable && <span className="text-[10px] text-ink-muted">{t('taken')}</span>}
              </button>
            );
          })}
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
