'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TaskSuggestionDto } from '@pmtool/shared-types';
import { useParseNlTasks, ApiError } from '@pmtool/api-client';
import { Button, Modal } from '@pmtool/ui';

export function NlTaskModal({
  orgSlug,
  projectKey,
  open,
  onClose,
  onSuggestions,
}: {
  orgSlug: string;
  projectKey: string;
  open: boolean;
  onClose: () => void;
  onSuggestions: (suggestions: TaskSuggestionDto[]) => void;
}) {
  const t = useTranslations('ai.nlCreate');
  const parseNlTasks = useParseNlTasks(orgSlug, projectKey);
  const [text, setText] = useState('');

  function handleClose() {
    setText('');
    parseNlTasks.reset();
    onClose();
  }

  function submit() {
    if (!text.trim()) return;
    parseNlTasks.mutate(
      { text: text.trim() },
      {
        onSuccess: (data) => {
          setText('');
          onSuggestions(data.suggestions);
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('title')} description={t('description')}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('placeholder')}
        rows={4}
        autoFocus
        className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
      {parseNlTasks.isError && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {parseNlTasks.error instanceof ApiError ? parseNlTasks.error.message : 'Có lỗi xảy ra'}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={handleClose}>
          {t('cancel')}
        </Button>
        <Button type="button" onClick={submit} disabled={!text.trim() || parseNlTasks.isPending}>
          {t('submit')}
        </Button>
      </div>
    </Modal>
  );
}
