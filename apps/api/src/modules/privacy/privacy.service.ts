import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const DELETED_NAME = 'Người dùng đã xoá';

/** Data portability (export) and the right to erasure, for people and for organizations. */
@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Everything PMTool holds about one person, across all their organizations. */
  async exportUser(userId: string) {
    const db = this.prisma.db;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const [
      memberships,
      projectRoles,
      assignments,
      comments,
      scores,
      badges,
      quests,
      activity,
    ] = await Promise.all([
      db.membership.findMany({
        where: { userId },
        include: { organization: { select: { name: true, slug: true } } },
      }),
      db.projectMember.findMany({
        where: { userId },
        include: { project: { select: { key: true, name: true } } },
      }),
      db.taskAssignee.findMany({
        where: { userId },
        include: {
          task: {
            select: {
              humanKey: true,
              title: true,
              status: true,
              dueDate: true,
            },
          },
        },
      }),
      db.comment.findMany({
        where: { authorId: userId },
        select: { taskId: true, body: true, createdAt: true },
      }),
      db.userScore.findMany({ where: { userId } }),
      db.userBadge.findMany({ where: { userId } }),
      db.userQuestProgress.findMany({ where: { userId } }),
      db.activityLog.findMany({
        where: { actorId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: {
          entityType: true,
          action: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
        themePref: user.themePref,
        mascotCharacter: user.mascotCharacter,
        emailVerified: user.emailVerifiedAt !== null,
        telegramLinked: user.telegramChatId !== null,
        dailyDigest: {
          enabled: user.dailyDigestEnabled,
          hour: user.dailyDigestHour,
        },
        createdAt: user.createdAt,
      },
      organizations: memberships.map((m) => ({
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
      projectRoles: projectRoles.map((p) => ({
        project: p.project.key,
        name: p.project.name,
        role: p.role,
      })),
      assignedTasks: assignments.map((a) => ({ ...a.task, role: a.role })),
      comments,
      scores,
      badges,
      quests,
      activity,
    };
  }

  /** The whole workspace of one organization, for its owners/admins to keep or migrate. */
  async exportOrganization(organizationId: string) {
    const db = this.prisma.db;
    const where = { organizationId };
    const [
      organization,
      members,
      projects,
      tasks,
      dependencies,
      comments,
      risks,
      charters,
      scopes,
      stakeholders,
      documents,
      deliverables,
      dictionary,
      artifacts,
      activity,
    ] = await Promise.all([
      db.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      db.membership.findMany({
        where,
        include: { user: { select: { email: true, fullName: true } } },
      }),
      db.project.findMany({ where }),
      db.task.findMany({
        where,
        orderBy: [{ projectId: 'asc' }, { orderIndex: 'asc' }],
        include: {
          assignees: {
            include: { user: { select: { email: true, fullName: true } } },
          },
        },
      }),
      db.taskDependency.findMany({ where }),
      db.comment.findMany({
        where,
        include: { author: { select: { email: true, fullName: true } } },
      }),
      db.riskIssue.findMany({ where }),
      db.projectCharter.findMany({ where }),
      db.projectScope.findMany({ where }),
      db.stakeholder.findMany({ where }),
      db.projectDocument.findMany({ where }),
      db.deliverable.findMany({ where }),
      db.wbsDictionaryEntry.findMany({ where }),
      db.artifact.findMany({ where }),
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10_000,
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      organization: {
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        createdAt: organization.createdAt,
      },
      members: members.map((m) => ({
        email: m.user.email,
        fullName: m.user.fullName,
        role: m.role,
      })),
      projects,
      tasks: tasks.map(({ assignees, ...t }) => ({
        ...t,
        assignees: assignees.map((a) => ({
          email: a.user.email,
          fullName: a.user.fullName,
          role: a.role,
        })),
      })),
      dependencies,
      comments: comments.map(({ author, ...c }) => ({
        ...c,
        author: { email: author.email, fullName: author.fullName },
      })),
      risks,
      charters,
      scopes,
      stakeholders,
      documents,
      deliverables,
      wbsDictionary: dictionary,
      artifacts,
      activity,
    };
  }

  /** Permanently deletes an organization and everything in it (its Owner, after re-entering their password). */
  async deleteOrganization(
    organizationId: string,
    userId: string,
    password: string,
  ): Promise<void> {
    const user = await this.prisma.db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new ForbiddenException('Mật khẩu không đúng');
    }
    // Every table that hangs off an organization cascades from this one row.
    await this.prisma.db.organization.delete({ where: { id: organizationId } });
  }

  /**
   * Erases a person: removes them from every organization (deleting organizations
   * where they are the only member), drops their personal records, and anonymizes
   * the account row. What they wrote in shared workspaces stays, attributed to
   * "Người dùng đã xoá", so other people's projects are not damaged.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const db = this.prisma.db;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.email.endsWith('@deleted.invalid'))
      throw new ForbiddenException('Tài khoản đã bị xoá');
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new ForbiddenException('Mật khẩu không đúng');
    }

    const memberships = await db.membership.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true } } },
    });
    const soleOrgIds: string[] = [];
    const blocking: string[] = [];
    for (const m of memberships) {
      const others = await db.membership.findMany({
        where: { organizationId: m.organizationId, userId: { not: userId } },
      });
      if (others.length === 0) soleOrgIds.push(m.organizationId);
      else if (m.role === 'OWNER' && !others.some((o) => o.role === 'OWNER'))
        blocking.push(m.organization.name);
    }
    if (blocking.length > 0) {
      throw new ConflictException(
        `Bạn là Owner duy nhất của: ${blocking.join(', ')}. Hãy chuyển quyền Owner cho người khác hoặc xoá các thành viên trước khi xoá tài khoản.`,
      );
    }

    await db.$transaction(async (tx) => {
      await tx.organization.deleteMany({ where: { id: { in: soleOrgIds } } });
      await tx.projectMember.deleteMany({ where: { userId } });
      await tx.membership.deleteMany({ where: { userId } });
      await tx.taskAssignee.deleteMany({ where: { userId } });
      await tx.userScore.deleteMany({ where: { userId } });
      await tx.userBadge.deleteMany({ where: { userId } });
      await tx.userQuestProgress.deleteMany({ where: { userId } });
      await tx.telegramLinkCode.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
      await tx.stakeholder.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@deleted.invalid`,
          fullName: DELETED_NAME,
          avatarUrl: null,
          passwordHash: await argon2.hash(randomBytes(32).toString('hex')),
          telegramChatId: null,
          emailVerifiedAt: null,
          dailyDigestEnabled: false,
        },
      });
    });
  }
}
