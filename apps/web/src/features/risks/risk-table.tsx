'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRiskIssues, useUpdateRiskIssue } from '@pmtool/api-client';
import type { RiskIssueDto } from '@pmtool/shared-types';
import { Badge, Button, Card, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@pmtool/ui';
import { UserAvatar } from '../people/user-avatar';
import { RiskTypeBadge, severityVariant } from './risk-badges';
import { CreateRiskModal } from './create-risk-modal';
import { usePermissions } from '../projects/use-permissions';

const STATUS_OPTIONS = ['IDENTIFIED', 'ANALYZING', 'MITIGATING', 'RESOLVED', 'CLOSED'] as const;

function StatusSelect({ orgSlug, projectKey, risk }: { orgSlug: string; projectKey: string; risk: RiskIssueDto }) {
  const t = useTranslations('risks.status');
  const updateRisk = useUpdateRiskIssue(orgSlug, projectKey);

  return (
    <Select
      aria-label={t(risk.status)}
      className="h-8 w-auto"
      value={risk.status}
      onChange={(e) =>
        updateRisk.mutate({ riskId: risk.id, input: { status: e.target.value as RiskIssueDto['status'] } })
      }
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {t(s)}
        </option>
      ))}
    </Select>
  );
}

export function RiskTable({ orgSlug, projectKey }: { orgSlug: string; projectKey: string }) {
  const t = useTranslations('risks.list');
  const { canEdit } = usePermissions(orgSlug, projectKey);
  const { data: risks, isLoading } = useRiskIssues(orgSlug, projectKey);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-primary">{t('title')}</h1>
          <p className="text-sm text-ink-secondary">{t('subtitle')}</p>
        </div>
        {canEdit && <Button onClick={() => setCreateOpen(true)}>{t('create')}</Button>}
      </div>

      <Card className="mt-6">
        {isLoading ? null : risks && risks.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('columnType')}</TableHeaderCell>
                <TableHeaderCell>{t('columnTitle')}</TableHeaderCell>
                <TableHeaderCell>{t('columnSeverity')}</TableHeaderCell>
                <TableHeaderCell>{t('columnStatus')}</TableHeaderCell>
                <TableHeaderCell>{t('columnOwner')}</TableHeaderCell>
                <TableHeaderCell>{t('columnDueDate')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {risks.map((risk) => (
                <TableRow key={risk.id}>
                  <TableCell>
                    <RiskTypeBadge type={risk.type} />
                  </TableCell>
                  <TableCell className="font-medium">{risk.title}</TableCell>
                  <TableCell>
                    {risk.severityScore != null ? (
                      <Badge variant={severityVariant(risk.severityScore)}>{risk.severityScore}</Badge>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusSelect orgSlug={orgSlug} projectKey={projectKey} risk={risk} />
                  </TableCell>
                  <TableCell>
                    {risk.owner ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar userId={risk.owner.id} name={risk.owner.fullName} />
                        {risk.owner.fullName}
                      </span>
                    ) : (
                      <span className="text-ink-muted">{t('unowned')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {risk.dueDate ? (
                      new Date(risk.dueDate).toLocaleDateString()
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 text-sm text-ink-secondary">{t('empty')}</p>
        )}
      </Card>

      <CreateRiskModal
        orgSlug={orgSlug}
        projectKey={projectKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
