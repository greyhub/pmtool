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
import { UsersModule } from '../users/users.module';

@Module({
  imports: [OrganizationsModule, UsersModule],
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
