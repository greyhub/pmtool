'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useOnboarding } from '@pmtool/api-client';
import { ONBOARDING_STEP_KEYS, type OnboardingStepKey } from '@pmtool/shared-types';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';
import { Link } from '../../i18n/navigation';

const storageKey = (orgSlug: string) => `pmtool.onboarding.dismissed.${orgSlug}`;

/** "Getting started": what a new organization should do next, ticked off from real data. */
export function OnboardingChecklist({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('dashboard.onboarding');
  const { data } = useOnboarding(orgSlug);
  const [dismissed, setDismissed] = useState(true); // hidden until we know, so it never flashes

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey(orgSlug)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [orgSlug]);

  if (!data || data.completed || dismissed) return null;

  const base = `/${orgSlug}`;
  const project = data.projectKey ? `${base}/projects/${data.projectKey}` : `${base}/projects`;
  const hrefs: Record<OnboardingStepKey, string> = {
    createProject: `${base}/projects`,
    addTasks: data.projectKey ? `${project}/tasks` : `${base}/projects`,
    inviteTeammate: `${base}/settings`,
    defineScope: data.projectKey ? `${project}/scope` : `${base}/projects`,
    addDeliverable: data.projectKey ? `${project}/deliverables` : `${base}/projects`,
  };
  const doneCount = data.steps.filter((s) => s.done).length;
  // The first step still to do gets the call to action.
  const nextKey = ONBOARDING_STEP_KEYS.find((k) => !data.steps.find((s) => s.key === k)?.done);

  return (
    <Card className="mt-6" data-testid="onboarding-checklist">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t('title')}</CardTitle>
            <p className="mt-1 text-sm text-ink-secondary">
              {t('subtitle', { done: doneCount, total: data.steps.length })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              try {
                window.localStorage.setItem(storageKey(orgSlug), '1');
              } catch {
                /* private mode: hide for this visit only */
              }
              setDismissed(true);
            }}
          >
            {t('dismiss')}
          </Button>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={data.steps.length}
          aria-valuenow={doneCount}
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle"
        >
          <div
            className="h-full rounded-full bg-action-primary"
            style={{ width: `${(doneCount / data.steps.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {data.steps.map((step) => (
            <li key={step.key}>
              <Link
                href={hrefs[step.key]}
                className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-subtle"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                    step.done ? 'border-success bg-success-bg text-success' : 'border-line-strong text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${step.done ? 'text-ink-muted line-through' : 'text-ink-primary'}`}
                  >
                    {t(`steps.${step.key}.title`)}
                  </span>
                  {!step.done && (
                    <span className="block text-xs text-ink-secondary">{t(`steps.${step.key}.hint`)}</span>
                  )}
                </span>
                {step.key === nextKey && (
                  <span className="shrink-0 text-xs font-semibold text-action-primary">{t('next')} →</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
