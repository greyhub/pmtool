'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError, useImportTasksCsv } from '@pmtool/api-client';
import type { ImportTasksResultDto } from '@pmtool/shared-types';
import { Button, Modal } from '@pmtool/ui';
import { downloadFile } from '../../lib/download-json';

const SAMPLE = [
  'ref,parent,title,type,status,priority,start,due,percent,assignee,description',
  'P1,,Giai đoạn 1,PHASE,,,2026-10-01,2026-10-31,,,',
  'D1,P1,Tài liệu yêu cầu,DELIVERABLE,,,,2026-10-15,,,',
  'A1,D1,Phỏng vấn khách hàng,ACTIVITY,IN_PROGRESS,HIGH,2026-10-01,2026-10-05,40,ten@congty.vn,Ghi chú tuỳ chọn',
].join('\r\n');

/** Pick a CSV, see what would be created (and every problem, by line), then import it. */
export function ImportTasksModal({
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
  const t = useTranslations('tasks.import');
  const importCsv = useImportTasksCsv(orgSlug, projectKey);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [check, setCheck] = useState<ImportTasksResultDto | null>(null);

  function close() {
    setCsv(null);
    setFileName('');
    setCheck(null);
    importCsv.reset();
    onClose();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setCheck(null);
    importCsv.mutate({ csv: text, dryRun: true }, { onSuccess: setCheck });
  }

  function doImport() {
    if (!csv) return;
    importCsv.mutate({ csv }, { onSuccess: (r) => (r.committed ? close() : setCheck(r)) });
  }

  const errors = check?.errors ?? [];
  const canImport = Boolean(check && check.valid > 0 && errors.length === 0);

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('title')}
      description={t('description')}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('cancel')}
          </Button>
          <Button disabled={!canImport || importCsv.isPending} onClick={doImport}>
            {check ? t('importN', { count: check.valid }) : t('import')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-4 text-sm font-semibold text-ink-primary hover:bg-surface-subtle focus-within:ring-2 focus-within:ring-focus">
            {t('choose')}
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label={t('choose')}
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
          <span className="text-sm text-ink-secondary">{fileName || t('noFile')}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadFile('mau-nhap-cong-viec.csv', `﻿${SAMPLE}\r\n`, 'text/csv')}
          >
            {t('sample')}
          </Button>
        </div>
        <p className="text-xs text-ink-muted">{t('columns')}</p>

        {importCsv.isPending && !check && <p className="text-sm text-ink-secondary">{t('checking')}</p>}
        {importCsv.isError && (
          <p role="alert" className="text-sm text-danger">
            {importCsv.error instanceof ApiError ? importCsv.error.message : t('error')}
          </p>
        )}

        {check && (
          <div data-testid="import-result" className="flex flex-col gap-3">
            <p className={`text-sm font-medium ${errors.length === 0 ? 'text-success' : 'text-ink-primary'}`}>
              {t('summary', { valid: check.valid, errors: errors.length })}
            </p>
            {errors.length > 0 && (
              <ul role="alert" className="max-h-40 overflow-auto rounded-md bg-danger-bg p-3 text-xs text-danger">
                {errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    {t('line', { line: e.line })}: {e.message}
                  </li>
                ))}
                {errors.length > 50 && <li>{t('moreErrors', { count: errors.length - 50 })}</li>}
              </ul>
            )}
            {check.preview.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface-subtle text-ink-secondary">
                    <tr>
                      <th className="px-2 py-1">{t('line', { line: '' }).trim()}</th>
                      <th className="px-2 py-1">{t('colTitle')}</th>
                      <th className="px-2 py-1">{t('colType')}</th>
                      <th className="px-2 py-1">{t('colParent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.preview.map((p) => (
                      <tr key={p.line} className="border-t border-line">
                        <td className="px-2 py-1 tabular-nums text-ink-muted">{p.line}</td>
                        <td className="px-2 py-1 text-ink-primary">{p.title}</td>
                        <td className="px-2 py-1">{p.nodeType}</td>
                        <td className="px-2 py-1 text-ink-secondary">{p.parent ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
