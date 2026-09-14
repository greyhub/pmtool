'use client';

import { useOrganizations } from '@pmtool/api-client';
import { OrgSwitcher } from '@pmtool/ui';
import type { OrganizationDto } from '@pmtool/shared-types';
import { useRouter } from '../../i18n/navigation';

export function OrgSwitcherWidget({ current }: { current: OrganizationDto }) {
  const router = useRouter();
  const { data: organizations } = useOrganizations();

  return (
    <OrgSwitcher
      current={current}
      options={organizations ?? [current]}
      onSelect={(slug) => router.push(`/${slug}/dashboard`)}
      onCreateNew={() => router.push('/onboarding/create-organization')}
      createNewLabel="+ Tạo tổ chức mới"
    />
  );
}
