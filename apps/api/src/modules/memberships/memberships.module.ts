import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { InvitesController } from './invites.controller';
import {
  JoinRequestsController,
  MyJoinRequestsController,
} from './join-requests.controller';
import { MembershipsService } from './memberships.service';
import { JoinRequestsService } from './join-requests.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [
    MembershipsController,
    InvitesController,
    JoinRequestsController,
    MyJoinRequestsController,
  ],
  providers: [MembershipsService, JoinRequestsService],
  exports: [MembershipsService, JoinRequestsService],
})
export class MembershipsModule {}
