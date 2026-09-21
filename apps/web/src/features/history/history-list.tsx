'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import type { HistoryPageDto } from '@pmtool/shared-types';
import { useOrganizationMembers } from '@pmtool/api-client';
import { Button } from '@pmtool/ui';
import { HistoryEntry, type PersonInfo } from './history-entry';

/** A page-by-page list of history entries, with the members' names resolved. */
export function HistoryList({
  orgSlug,
  query,
  showProject = false,
  emptyText,
}: {
  orgSlug: string;
  query: UseInfiniteQueryResult<InfiniteData<HistoryPageDto>, Error>;
  showProject?: boolean;
  emptyText?: string;
}) {
  const t = useTranslations('history');
  const { data: members } = useOrganizationMembers(orgSlug);
  const people = useMemo(() => {
    const map = new Map<string, PersonInfo>();
    for (const m of members ?? [])
      if (m.user) map.set(m.userId, { name: m.user.fullName, character: m.user.mascotCharacter });
    return map;
  }, [members]);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading) return <p className="text-sm text-ink-secondary">{t('loading')}</p>;
  if (query.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {t('error')}
      </p>
    );
  }
  if (items.length === 0)
    return <p className="text-sm text-ink-muted">{emptyText ?? t('empty')}</p>;

  return (
    <div>
      <ul className="divide-y divide-line-glass" data-testid="history-list">
        {items.map((e) => (
          <HistoryEntry key={e.id} entry={e} people={people} showProject={showProject} />
        ))}
      </ul>
      {query.hasNextPage && (
        <div className="pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
