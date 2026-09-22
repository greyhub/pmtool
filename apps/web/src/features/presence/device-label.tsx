import { useTranslations } from 'next-intl';
import { parseUserAgent } from '../../lib/parse-user-agent';

export function DeviceLabel({ userAgent }: { userAgent: string | null }) {
  const t = useTranslations('presence');
  const { browser, os } = parseUserAgent(userAgent);
  if (browser && os) return <>{t('deviceBoth', { browser, os })}</>;
  if (browser) return <>{browser}</>;
  if (os) return <>{os}</>;
  return <>{t('deviceUnknown')}</>;
}
