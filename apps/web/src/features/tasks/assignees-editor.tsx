'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useOrganizationMembers } from '@pmtool/api-client';
import type { TaskDto } from '@pmtool/shared-types';
import { Avatar } from '@pmtool/ui';

export function AssigneesEditor({
  orgSlug,
  task,
  onChange,
}: {
  orgSlug: string;
  task: TaskDto;
  onChange: (assigneeIds: string[]) => void;
}) {
  const t = useTranslations('tasks.detail');
  const { data: members } = useOrganizationMembers(orgSlug);
  const [open, setOpen] = useState(false);

  const assignedIds = new Set(task.assignees.map((a) => a.id));
  const candidates = (members ?? []).filter((m) => !assignedIds.has(m.userId));

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-secondary">{t('assignees')}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {task.assignees.length === 0 && <p className="text-sm text-ink-muted">{t('noAssignees')}</p>}
        {task.assignees.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5 rounded-full bg-surface-subtle py-1 pl-1 pr-2 text-sm">
            <Avatar name={a.fullName} src={a.avatarUrl} size="sm" />
            {a.fullName}
            <button
              type="button"
              aria-label={`Bỏ ${a.fullName}`}
              onClick={() => onChange(task.assignees.filter((x) => x.id !== a.id).map((x) => x.id))}
              className="text-ink-muted hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-line text-ink-muted hover:border-action-primary hover:text-ink-primary"
            aria-label="Thêm người phụ trách"
          >
            +
          </button>
          {open && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-line-glass bg-surface-glass-strong py-1 shadow-xl shadow-black/10 backdrop-blur-2xl">
              {candidates.length === 0 && <p className="px-3 py-2 text-sm text-ink-muted">—</p>}
              {candidates.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => {
                    onChange([...task.assignees.map((x) => x.id), m.userId]);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-primary hover:bg-surface-subtle"
                >
                  <span aria-hidden="true">
                    <Avatar name={m.user?.fullName ?? ''} src={m.user?.avatarUrl} size="sm" />
                  </span>
                  {m.user?.fullName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
