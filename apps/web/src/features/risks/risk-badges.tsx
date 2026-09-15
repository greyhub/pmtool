import { useTranslations } from 'next-intl';
import { Badge } from '@pmtool/ui';
import type { RiskIssueDto } from '@pmtool/shared-types';

const TYPE_VARIANT = {
  RISK: 'warning',
  ISSUE: 'danger',
} as const;

const STATUS_VARIANT = {
  IDENTIFIED: 'neutral',
  ANALYZING: 'info',
  MITIGATING: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
} as const;

export function RiskTypeBadge({ type }: { type: RiskIssueDto['type'] }) {
  const t = useTranslations('risks.type');
  return <Badge variant={TYPE_VARIANT[type]}>{t(type)}</Badge>;
}

export function RiskStatusBadge({ status }: { status: RiskIssueDto['status'] }) {
  const t = useTranslations('risks.status');
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}

export function severityVariant(score: number | null): 'neutral' | 'success' | 'warning' | 'danger' {
  if (score == null) return 'neutral';
  if (score >= 15) return 'danger';
  if (score >= 8) return 'warning';
  return 'success';
}
