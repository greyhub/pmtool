import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { InvitesController } from './invites.controller';
import { MembershipsService } from './memberships.service';

@Module({
  controllers: [MembershipsController, InvitesController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
