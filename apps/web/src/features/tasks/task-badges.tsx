import { useTranslations } from 'next-intl';
import { Badge } from '@pmtool/ui';
import type { TaskDto } from '@pmtool/shared-types';

export const STATUS_VARIANT = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  IN_REVIEW: 'warning',
  DONE: 'success',
  BLOCKED: 'danger',
} as const;

export const PRIORITY_VARIANT = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
} as const;

export function TaskStatusBadge({ status }: { status: TaskDto['status'] }) {
  const t = useTranslations('tasks.status');
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}

export function TaskPriorityBadge({ priority }: { priority: TaskDto['priority'] }) {
  const t = useTranslations('tasks.priority');
  return <Badge variant={PRIORITY_VARIANT[priority]}>{t(priority)}</Badge>;
}
