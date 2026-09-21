'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useBulkNodeType } from '@pmtool/api-client';
import { WBS_NODE_TYPES, type BulkNodeTypeResultDto, type WbsNodeType } from '@pmtool/shared-types';
import { Button, Modal, Select } from '@pmtool/ui';

function ErrorList({ errors }: { errors: BulkNodeTypeResultDto['errors'] }) {
  const t = useTranslations('wbs.bulk');
  if (errors.length === 0) return null;
  return (
    <ul role="alert" className="max-h-40 overflow-auto rounded-md bg-danger-bg p-3 text-xs text-danger">
      {errors.slice(0, 30).map((e, i) => (
        <li key={i}>
          {e.humanKey ? <span className="font-mono">{e.humanKey}: </span> : null}
          {e.message}
        </li>
      ))}
      {errors.length > 30 && <li>{t('moreErrors', { count: errors.length - 30 })}</li>}
    </ul>
  );
}

/** Shown while "select several" is on: pick a level for the ticked tasks and apply it. */
export function BulkSelectionBar({
  orgSlug,
  projectKey,
  picked,
  total,
  level,
  onLevel,
  onSelectAll,
  onClear,
  onDone,
}: {
  orgSlug: string;
  projectKey: string;
  picked: string[];
  total: number;
  level: WbsNodeType;
  onLevel: (l: WbsNodeType) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('wbs.bulk');
  const tType = useTranslations('tasks.nodeType');
  const bulk = useBulkNodeType(orgSlug, projectKey);
  const result = bulk.data;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-surface p-3" data-testid="bulk-bar">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink-primary">{t('selected', { count: picked.length })}</span>
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
          {t('selectAll', { count: total })}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={picked.length === 0}>
          {t('clear')}
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor="bulk-level" className="text-sm text-ink-secondary">
            {t('setLevel')}
          </label>
          <Select
            id="bulk-level"
            className="w-auto"
            value={level}
            onChange={(e) => onLevel(e.target.value as WbsNodeType)}
          >
            {WBS_NODE_TYPES.map((type) => (
              <option key={type} value={type}>
                {tType(type)}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={picked.length === 0 || bulk.isPending}
            onClick={() =>
              bulk.mutate({ taskIds: picked, nodeType: level }, { onSuccess: (r) => r.committed && onDone() })
            }
          >
            {t('apply')}
          </Button>
        </span>
      </div>
      {result && !result.committed && result.errors.length === 0 && result.changed === 0 && (
        <p className="text-sm text-ink-secondary">{t('nothingToChange')}</p>
      )}
      {result && <ErrorList errors={result.errors} />}
      {bulk.isError && (
        <p role="alert" className="text-sm text-danger">
          {bulk.error instanceof ApiError ? bulk.error.message : t('error')}
        </p>
      )}
    </div>
  );
}

/** "Set every level from tree depth": previews the outcome first, then applies it. */
export function AutoLevelModal({
  orgSlug,
  projectKey,
  open,
  onClose,
}: {
  orgSlug: string;
  projectKey: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('wbs.bulk');
  const tType = useTranslations('tasks.nodeType');
  const bulk = useBulkNodeType(orgSlug, projectKey);
  const { mutate, reset } = bulk;

  useEffect(() => {
    if (open) mutate({ byDepth: true, dryRun: true });
    else reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const preview = bulk.data && !bulk.data.committed ? bulk.data : null;
  const canApply = Boolean(preview && preview.errors.length === 0 && preview.changed > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('autoTitle')}
      description={t('autoDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            disabled={!canApply || bulk.isPending}
            onClick={() => bulk.mutate({ byDepth: true }, { onSuccess: (r) => r.committed && onClose() })}
          >
            {preview ? t('autoApply', { count: preview.changed }) : t('apply')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-testid="auto-level-preview">
        {!preview && bulk.isPending && <p className="text-sm text-ink-secondary">{t('checking')}</p>}
        {preview && (
          <>
            <p className="text-sm text-ink-primary">
              {preview.changed === 0 ? t('autoNothing') : t('autoSummary', { count: preview.changed })}
            </p>
            <ul className="grid grid-cols-2 gap-2 text-sm text-ink-secondary">
              {WBS_NODE_TYPES.map((type) => (
                <li key={type} className="flex justify-between rounded-md bg-surface-subtle px-3 py-1.5">
                  <span>{tType(type)}</span>
                  <span className="tabular-nums font-medium text-ink-primary">{preview.counts[type]}</span>
                </li>
              ))}
            </ul>
            <ErrorList errors={preview.errors} />
          </>
        )}
        {bulk.isError && (
          <p role="alert" className="text-sm text-danger">
            {bulk.error instanceof ApiError ? bulk.error.message : t('error')}
          </p>
        )}
      </div>
    </Modal>
  );
}
