'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDeleteStakeholder, useStakeholders } from '@pmtool/api-client';
import type { StakeholderDto } from '@pmtool/shared-types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@pmtool/ui';
import { StakeholderFormModal } from './stakeholder-form-modal';
import { usePermissions } from '../projects/use-permissions';

const LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const; // grid rows, top to bottom
const COLUMNS = ['LOW', 'MEDIUM', 'HIGH'] as const; // grid columns, left to right

const LEVEL_VARIANT = {
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'danger',
} as const;

function PowerInterestGrid({ stakeholders }: { stakeholders: StakeholderDto[] }) {
  const t = useTranslations('stakeholders.grid');
  const tLevel = useTranslations('stakeholders.level');

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-medium text-ink-secondary">{t('title')}</p>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-1 text-xs text-ink-muted">
          {LEVELS.map((l) => (
            <span key={l} className="flex h-24 items-center">
              {tLevel(l)}
            </span>
          ))}
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-3 gap-1.5">
            {LEVELS.map((interest) =>
              COLUMNS.map((influence) => {
                const cell = stakeholders.filter((s) => s.interest === interest && s.influence === influence);
                return (
                  <div
                    key={`${interest}-${influence}`}
                    className="flex h-24 flex-wrap content-start gap-1 rounded-md border border-line-glass bg-surface-subtle p-2"
                  >
                    {cell.map((s) => (
                      <span key={s.id} title={s.fullName}>
                        <Avatar name={s.fullName} size="sm" />
                      </span>
                    ))}
                  </div>
                );
              }),
            )}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-1.5 text-center text-xs text-ink-muted">
            {COLUMNS.map((c) => (
              <span key={c}>{tLevel(c)}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-muted">{t('axisHint')}</p>
    </Card>
  );
}

export function StakeholderTable({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('stakeholders.list');
  const { canManage } = usePermissions(orgSlug, projectKey);
  const tLevel = useTranslations('stakeholders.level');
  const tEngagement = useTranslations('stakeholders.engagement');
  const { data: stakeholders, isLoading } = useStakeholders(orgSlug, projectKey);
  const deleteStakeholder = useDeleteStakeholder(orgSlug, projectKey);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StakeholderDto | undefined>(undefined);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
          >
            {t('create')}
          </Button>
        )}
      </div>

      {!isLoading && stakeholders && stakeholders.length > 0 && (
        <div className="mt-6">
          <PowerInterestGrid stakeholders={stakeholders} />
        </div>
      )}

      <Card className="mt-6">
        {isLoading ? null : stakeholders && stakeholders.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('columnName')}</TableHeaderCell>
                <TableHeaderCell>{t('columnRole')}</TableHeaderCell>
                <TableHeaderCell>{t('columnInfluence')}</TableHeaderCell>
                <TableHeaderCell>{t('columnInterest')}</TableHeaderCell>
                <TableHeaderCell>{t('columnEngagement')}</TableHeaderCell>
                <TableHeaderCell></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stakeholders.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <Avatar name={s.fullName} size="sm" />
                      {s.fullName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-ink-secondary">{s.role || '—'}</span>
                    {s.organizationName && <span className="block text-xs text-ink-muted">{s.organizationName}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={LEVEL_VARIANT[s.influence]}>{tLevel(s.influence)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={LEVEL_VARIANT[s.interest]}>{tLevel(s.interest)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-ink-secondary">
                    {tEngagement(s.currentEngagement)} → {tEngagement(s.desiredEngagement)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(s);
                              setModalOpen(true);
                            }}
                          >
                            {t('edit')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteStakeholder.mutate(s.id)}>
                            {t('delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>

      <StakeholderFormModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
