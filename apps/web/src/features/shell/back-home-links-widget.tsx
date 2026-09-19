'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BackHomeLinks } from '@pmtool/ui';
import { Link, useRouter } from '../../i18n/navigation';

function HomeLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function BackHomeLinksWidget({ homeHref, className }: { homeHref: string; className?: string }) {
  const router = useRouter();
  const t = useTranslations('nav');

  return (
    <BackHomeLinks
      onBack={() => router.back()}
      backLabel={t('back')}
      homeHref={homeHref}
      homeLabel={t('home')}
      LinkComponent={HomeLink}
      className={className}
    />
  );
}
