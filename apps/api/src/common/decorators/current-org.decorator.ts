import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrgRole, Organization } from '@prisma/client';

export interface CurrentOrgContext {
  organization: Organization;
  membershipId: string;
  role: OrgRole;
}

export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentOrgContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.currentOrg;
  },
);
