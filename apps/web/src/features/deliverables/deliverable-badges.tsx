import { useTranslations } from 'next-intl';
import { Badge } from '@pmtool/ui';
import type { DeliverableDto } from '@pmtool/shared-types';

export const DELIVERABLE_STATUS_VARIANT = {
  PLANNED: 'neutral',
  IN_PROGRESS: 'info',
  SUBMITTED: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
} as const;

export function DeliverableStatusBadge({ status }: { status: DeliverableDto['status'] }) {
  const t = useTranslations('deliverables.status');
  return <Badge variant={DELIVERABLE_STATUS_VARIANT[status]}>{t(status)}</Badge>;
}
