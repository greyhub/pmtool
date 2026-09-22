'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HISTORY_ACTIONS, HISTORY_ENTITY_TYPES } from '@pmtool/shared-types';
import {
  useAuditTrail,
  useOrganizationMembers,
  useProjectHistory,
  useProjects,
} from '@pmtool/api-client';
import { Input, Select } from '@pmtool/ui';
import { HistoryList } from './history-list';
import { OrgLoginHistoryList } from '../presence/org-login-history-list';

const PROJECT_TYPES = HISTORY_ENTITY_TYPES.filter(
  (x) => x !== 'Organization' && x !== 'Membership',
);

interface Filters {
  entityType: string;
  action: string;
  actorId: string;
  from: string;
  to: string;
  projectKey: string;
}
const NONE: Filters = { entityType: '', action: '', actorId: '', from: '', to: '', projectKey: '' };

function FilterBar({
  orgSlug,
  filters,
  setFilters,
  types,
  withProject,
}: {
  orgSlug: string;
  filters: Filters;
  setFilters: (f: Filters) => void;
  types: readonly string[];
  withProject: boolean;
}) {
  const t = useTranslations('history');
  const { data: members } = useOrganizationMembers(orgSlug);
  const { data: projects } = useProjects(withProject ? orgSlug : undefined);
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="flex flex-wrap items-end gap-3" role="search" aria-label={t('filters')}>
      {withProject && (
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          {t('filter.project')}
          <Select
            className="w-40"
            value={filters.projectKey}
            onChange={(e) => set({ projectKey: e.target.value })}
          >
            <option value="">{t('filter.all')}</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.key}>
                {p.key} — {p.name}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t('filter.type')}
        <Select
          className="w-44"
          value={filters.entityType}
          onChange={(e) => set({ entityType: e.target.value })}
        >
          <option value="">{t('filter.all')}</option>
          {types.map((x) => (
            <option key={x} value={x}>
              {t(`entityTypes.${x}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t('filter.action')}
        <Select
          className="w-36"
          value={filters.action}
          onChange={(e) => set({ action: e.target.value })}
        >
          <option value="">{t('filter.all')}</option>
          {HISTORY_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {t(`actions.${a}`)}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t('filter.person')}
        <Select
          className="w-44"
          value={filters.actorId}
          onChange={(e) => set({ actorId: e.target.value })}
        >
          <option value="">{t('filter.all')}</option>
          {(members ?? []).map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user?.fullName}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t('filter.from')}
        <Input
          type="date"
          className="w-40"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => set({ from: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        {t('filter.to')}
        <Input
          type="date"
          className="w-40"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => set({ to: e.target.value })}
        />
      </label>
      {active && (
        <button
          type="button"
          onClick={() => setFilters(NONE)}
          className="pb-2 text-sm text-ink-secondary underline hover:text-ink-primary"
        >
          {t('filter.clear')}
        </button>
      )}
    </div>
  );
}

const clean = (f: Filters) => ({
  entityType: f.entityType || undefined,
  action: (f.action || undefined) as 'CREATE' | 'UPDATE' | 'DELETE' | undefined,
  actorId: f.actorId || undefined,
  from: f.from || undefined,
  to: f.to || undefined,
});

/** Everything that changed in one project, filterable. */
export function ProjectHistoryView({
  orgSlug,
  projectKey,
}: {
  orgSlug: string;
  projectKey: string;
}) {
  const t = useTranslations('history');
  const [filters, setFilters] = useState<Filters>(NONE);
  const query = useProjectHistory(orgSlug, projectKey, clean(filters));
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-primary">{t('projectTitle')}</h1>
        <p className="text-sm text-ink-secondary">{t('projectSubtitle')}</p>
      </div>
      <FilterBar
        orgSlug={orgSlug}
        filters={filters}
        setFilters={setFilters}
        types={PROJECT_TYPES}
        withProject={false}
      />
      <div className="glass rounded-xl p-4">
        <HistoryList orgSlug={orgSlug} query={query} />
      </div>
    </div>
  );
}

/** The organization-wide audit trail: every project, members and settings (owners and admins). */
export function AuditView({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('history');
  const tPresence = useTranslations('presence');
  const [tab, setTab] = useState<'changes' | 'logins'>('changes');
  const [filters, setFilters] = useState<Filters>(NONE);
  const query = useAuditTrail(orgSlug, {
    ...clean(filters),
    projectKey: filters.projectKey || undefined,
  });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink-primary">{t('auditTitle')}</h1>
        <p className="text-sm text-ink-secondary">{t('auditSubtitle')}</p>
      </div>
      <div role="tablist" className="flex gap-1 rounded-full bg-surface-subtle p-1 sm:w-fit">
        {(['changes', 'logins'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              tab === key
                ? 'glass-field text-ink-primary'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {tPresence(key === 'changes' ? 'tabChanges' : 'tabLogins')}
          </button>
        ))}
      </div>
      {tab === 'changes' ? (
        <>
          <FilterBar
            orgSlug={orgSlug}
            filters={filters}
            setFilters={setFilters}
            types={HISTORY_ENTITY_TYPES}
            withProject
          />
          <div className="glass rounded-xl p-4">
            <HistoryList orgSlug={orgSlug} query={query} showProject />
          </div>
        </>
      ) : (
        <div className="glass rounded-xl p-4">
          <OrgLoginHistoryList orgSlug={orgSlug} />
        </div>
      )}
    </div>
  );
}
