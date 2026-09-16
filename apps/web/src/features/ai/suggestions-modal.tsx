'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskSuggestionDto } from '@pmtool/shared-types';
import { useCreateTask } from '@pmtool/api-client';
import { Button, Modal } from '@pmtool/ui';

type ItemStatus = 'idle' | 'pending' | 'success' | 'error';

export function SuggestionsModal({
  orgSlug,
  projectKey,
  title,
  suggestions,
  parentTaskId,
  open,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  title: string;
  suggestions: TaskSuggestionDto[];
  parentTaskId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('ai.suggestions');
  const tPriority = useTranslations('tasks.priority');
  const createTask = useCreateTask(orgSlug, projectKey);

  const [checked, setChecked] = useState<boolean[]>(() => suggestions.map(() => true));
  const [statuses, setStatuses] = useState<ItemStatus[]>(() => suggestions.map(() => 'idle'));

  useEffect(() => {
    setChecked(suggestions.map(() => true));
    setStatuses(suggestions.map(() => 'idle'));
  }, [suggestions]);

  const anyPending = statuses.some((s) => s === 'pending');
  const anyCheckedIdleOrError = suggestions.some((_, i) => checked[i] && (statuses[i] === 'idle' || statuses[i] === 'error'));

  async function acceptChecked() {
    const indices = suggestions.map((_, i) => i).filter((i) => checked[i] && (statuses[i] === 'idle' || statuses[i] === 'error'));
    setStatuses((prev) => prev.map((s, i) => (indices.includes(i) ? 'pending' : s)));

    await Promise.all(
      indices.map(async (i) => {
        const suggestion = suggestions[i]!;
        try {
          await createTask.mutateAsync({
            title: suggestion.title,
            priority: suggestion.priority,
            dueDate: suggestion.dueDate,
            estimateHours: suggestion.estimateHours,
            parentTaskId,
          });
          setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'success' : s)));
        } catch {
          setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'error' : s)));
        }
      }),
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {suggestions.length === 0 ? (
        <p className="text-sm text-ink-secondary">{t('empty')}</p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {suggestions.map((suggestion, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border border-line p-3">
              <input
                type="checkbox"
                checked={checked[i]}
                disabled={statuses[i] === 'pending' || statuses[i] === 'success'}
                onChange={(e) => setChecked((prev) => prev.map((c, idx) => (idx === i ? e.target.checked : c)))}
                className="h-4 w-4 shrink-0 accent-action-primary"
              />
              <div className="flex-1">
                <p className="text-sm text-ink-primary">{suggestion.title}</p>
                {suggestion.priority && (
                  <p className="text-xs text-ink-muted">{tPriority(suggestion.priority)}</p>
                )}
              </div>
              <span className="shrink-0 text-xs">
                {statuses[i] === 'pending' && <span className="text-ink-muted">{t('statusPending')}</span>}
                {statuses[i] === 'success' && <span className="text-success">{t('statusSuccess')}</span>}
                {statuses[i] === 'error' && <span className="text-danger">{t('statusError')}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('close')}
        </Button>
        {suggestions.length > 0 && (
          <Button type="button" onClick={acceptChecked} disabled={anyPending || !anyCheckedIdleOrError}>
            {t('addSelected')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
