import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.schema';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { BoardsModule } from './modules/boards/boards.module';
import { RisksModule } from './modules/risks/risks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ActivityModule } from './modules/activity/activity.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { AiModule } from './modules/ai/ai.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { CharterModule } from './modules/charter/charter.module';
import { ScopeModule } from './modules/scope/scope.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { MailModule } from './modules/mail/mail.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { StakeholdersModule } from './modules/stakeholders/stakeholders.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DeliverablesModule } from './modules/deliverables/deliverables.module';
import { MilestonesModule } from './modules/milestones/milestones.module';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { HealthModule } from './modules/health/health.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    JwtModule.register({}),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    MembershipsModule,
    ProjectsModule,
    TasksModule,
    BoardsModule,
    RisksModule,
    DashboardModule,
    ActivityModule,
    GamificationModule,
    AiModule,
    TelegramModule,
    CharterModule,
    ScopeModule,
    RateLimitModule,
    MailModule,
    PrivacyModule,
    NotificationsModule,
    StakeholdersModule,
    DocumentsModule,
    DeliverablesModule,
    MilestonesModule,
    ArtifactsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    RequestContextMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
