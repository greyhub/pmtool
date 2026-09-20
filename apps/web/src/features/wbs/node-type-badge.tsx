import { useTranslations } from 'next-intl';
import { Badge } from '@pmtool/ui';
import type { WbsNodeType } from '@pmtool/shared-types';

export const NODE_TYPE_VARIANT = {
  PHASE: 'primary',
  DELIVERABLE: 'success',
  WORK_PACKAGE: 'info',
  ACTIVITY: 'neutral',
} as const;

export function NodeTypeBadge({ type }: { type: WbsNodeType }) {
  const t = useTranslations('tasks.nodeType');
  const help = useTranslations('tasks.nodeTypeHelp');
  return (
    <Badge variant={NODE_TYPE_VARIANT[type]} title={help(type)} className="shrink-0 whitespace-nowrap">
      {t(type)}
    </Badge>
  );
}
