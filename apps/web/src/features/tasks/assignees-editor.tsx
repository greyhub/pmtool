'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useOrganizationMembers } from '@pmtool/api-client';
import type { TaskDto, UpdateTaskInput } from '@pmtool/shared-types';
import { useAnchoredMenu } from '../../lib/use-anchored-menu';
import { fold } from '../command-palette/filter';
import { UserAvatar } from '../people/user-avatar';

type Assignment = Pick<UpdateTaskInput, 'assigneeId' | 'supporterIds'>;
const MENU_WIDTH = 224; // w-56

/**
 * A "+" button that opens a list of org members to pick from. Portaled to the document body: this sits
 * inside a glass Card, and Card uses backdrop-filter, which creates its own stacking context — a plain
 * `position: absolute` dropdown would paint *behind* the next Card down the page (Dependencies) instead of
 * over it, no matter how high its z-index, since z-index only competes within the same stacking context.
 */
function MemberPicker({
  candidates,
  label,
  onPick,
}: {
  candidates: { userId: string; user?: { fullName: string; avatarUrl: string | null } | null }[];
  label: string;
  onPick: (userId: string) => void;
}) {
  const t = useTranslations('tasks.detail');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const pos = useAnchoredMenu(
    open,
    btnRef,
    (box) => ({
      left: Math.min(box.left, window.innerWidth - MENU_WIDTH - 16),
      top: box.bottom + 4,
    }),
    () => setOpen(false),
  );

  const shown =
    query.trim().length === 0
      ? candidates
      : candidates.filter((m) => fold(m.user?.fullName ?? '').includes(fold(query)));

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!open) setQuery('');
          setOpen((o) => !o);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-line text-ink-muted hover:border-action-primary hover:text-ink-primary"
        aria-label={label}
        title={label}
      >
        +
      </button>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
            <div
              role="menu"
              aria-label={label}
              className="fixed z-50 flex w-56 flex-col glass-strong rounded-md py-1"
              style={{ left: pos.left, top: pos.top }}
            >
              {/* Only worth showing once there's enough people to actually need it. */}
              {candidates.length > 5 && (
                <div className="px-2 pb-1">
                  <input
                    type="text"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && shown.length === 1) {
                        onPick(shown[0]!.userId);
                        setOpen(false);
                      }
                    }}
                    placeholder={t('searchMember')}
                    className="glass-field h-8 w-full rounded-md border border-line-glass px-2 text-sm text-ink-primary outline-none focus-visible:border-action-primary focus-visible:ring-2 focus-visible:ring-focus"
                  />
                </div>
              )}
              <div className="max-h-64 overflow-y-auto">
                {shown.length === 0 && (
                  <p className="px-3 py-2 text-sm text-ink-muted">
                    {candidates.length === 0 ? '—' : t('noMemberFound')}
                  </p>
                )}
                {shown.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPick(m.userId);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-primary hover:bg-surface-subtle"
                  >
                    <span aria-hidden="true">
                      <UserAvatar userId={m.userId} name={m.user?.fullName ?? ''} />
                    </span>
                    {m.user?.fullName}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

function PersonChip({
  person,
  onRemove,
  primary,
}: {
  person: TaskDto['assignees'][number];
  onRemove: () => void;
  primary?: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-sm ${
        primary ? 'bg-action-primary/15 ring-1 ring-action-primary' : 'bg-surface-subtle'
      }`}
    >
      <UserAvatar userId={person.id} name={person.fullName} character={person.mascotCharacter} />
      {person.fullName}
      <button
        type="button"
        aria-label={`Bỏ ${person.fullName}`}
        onClick={onRemove}
        className="text-ink-muted hover:text-danger"
      >
        ×
      </button>
    </span>
  );
}

/**
 * One accountable assignee plus any number of supporters. Each edit sends
 * only the half it changes — the server keeps the other half as it is.
 */
export function AssigneesEditor({
  orgSlug,
  task,
  onChange,
}: {
  orgSlug: string;
  task: TaskDto;
  onChange: (change: Assignment) => void;
}) {
  const t = useTranslations('tasks.detail');
  const { data: members } = useOrganizationMembers(orgSlug);

  const primary = task.assignees.find((a) => a.role === 'PRIMARY');
  const supporters = task.assignees.filter((a) => a.role === 'SUPPORT');
  const supporterIds = supporters.map((s) => s.id);

  const notTaken = (members ?? []).filter(
    (m) => m.userId !== primary?.id && !supporterIds.includes(m.userId),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-ink-secondary">{t('assignee')}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {primary ? (
            <PersonChip primary person={primary} onRemove={() => onChange({ assigneeId: null })} />
          ) : (
            <p className="text-sm text-ink-muted">{t('noAssignee')}</p>
          )}
          {/* Anyone but the current primary — including a current supporter, who is promoted. */}
          <MemberPicker
            label={primary ? t('changeAssignee') : t('assignAssignee')}
            candidates={(members ?? []).filter((m) => m.userId !== primary?.id)}
            onPick={(userId) => onChange({ assigneeId: userId })}
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-muted">{t('assigneeHint')}</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink-secondary">{t('supporters')}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {supporters.length === 0 && <p className="text-sm text-ink-muted">{t('noSupporters')}</p>}
          {supporters.map((s) => (
            <PersonChip
              key={s.id}
              person={s}
              onRemove={() => onChange({ supporterIds: supporterIds.filter((id) => id !== s.id) })}
            />
          ))}
          <MemberPicker
            label={t('addSupporter')}
            candidates={notTaken}
            onPick={(userId) => onChange({ supporterIds: [...supporterIds, userId] })}
          />
        </div>
      </div>
    </div>
  );
}
