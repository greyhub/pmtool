'use client';

import { useLocale } from 'next-intl';
import { LocaleSwitcher } from '@pmtool/ui';
import { usePathname, useRouter } from '../../i18n/navigation';
import { locales } from '../../i18n/locales';

const LOCALE_LABELS: Record<string, string> = { vi: 'Tiếng Việt', en: 'English' };

export function LocaleSwitcherWidget() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <LocaleSwitcher
      value={locale}
      options={locales.map((code) => ({ code, label: LOCALE_LABELS[code] ?? code }))}
      onChange={(nextLocale) => router.replace(pathname, { locale: nextLocale })}
    />
  );
}
