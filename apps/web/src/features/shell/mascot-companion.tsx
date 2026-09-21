'use client';

import { useTranslations } from 'next-intl';
import { useMe } from '@pmtool/api-client';
import { Mascot } from 'page-mascot';

export function MascotCompanion() {
  const t = useTranslations('settings.character');
  const me = useMe();

  if (!me.data) return null;

  return (
    // Mascot's own root element carries an inline `position: relative` style
    // (required internally so its absolutely-positioned sprite layers anchor
    // correctly) — inline styles beat a `fixed` Tailwind class on the same
    // element, so the viewport-corner pinning has to happen on a wrapper.
    //
    // Bottom-LEFT, not bottom-right: this codebase's own convention is
    // right-aligned form actions (`justify-end`, confirmed across
    // org-settings/project-settings/charter forms) — a bottom-right overlay
    // intercepts clicks on real "Lưu"/"Gửi lời mời" buttons at ordinary
    // viewport heights (~720px). Bottom-left is consistently empty
    // whitespace in every shell (below the sidebar nav, or on chrome-less
    // pages with no content down there).
    <div className="fixed bottom-4 left-4 z-30 hidden drop-shadow-md sm:block print:hidden">
      <Mascot
        directions={`/mascots/${me.data.mascotCharacter}-directions.webp`}
        reactions={`/mascots/${me.data.mascotCharacter}-reactions.webp`}
        size={72}
        label={t('label')}
      />
    </div>
  );
}
