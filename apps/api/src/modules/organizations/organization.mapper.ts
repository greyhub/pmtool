import { Organization } from '@prisma/client';
import { OrganizationDto } from '@pmtool/shared-types';

export function toOrganizationDto(org: Organization): OrganizationDto {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt.toISOString(),
  };
}
