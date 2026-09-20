import { Injectable, Optional } from '@nestjs/common';
import { Comment, User } from '@prisma/client';
import { CreateCommentInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { toRichText } from './rich-text.util';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';

const COMMENT_INCLUDE = {
  author: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamificationService: GamificationService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async list(
    organizationId: string,
    taskId: string,
  ): Promise<
    (Comment & { author: Pick<User, 'id' | 'fullName' | 'avatarUrl'> })[]
  > {
    return this.prisma.db.comment.findMany({
      where: { organizationId, taskId },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    organizationId: string,
    taskId: string,
    authorId: string,
    input: CreateCommentInput,
  ) {
    const comment = await this.prisma.db.comment.create({
      data: { organizationId, taskId, authorId, body: toRichText(input.body) },
      include: COMMENT_INCLUDE,
    });
    await this.gamificationService.awardPoints(
      organizationId,
      authorId,
      2,
      'comment_created',
    );
    // Tell whoever works on the task (and its creator) that someone commented.
    const task = await this.prisma.db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        humanKey: true,
        createdById: true,
        assignees: { select: { userId: true } },
      },
    });
    if (task) {
      await this.notifications?.notify({
        organizationId,
        userIds: [...task.assignees.map((a) => a.userId), task.createdById],
        type: 'TASK_COMMENT',
        actorId: authorId,
        entityKind: 'task',
        entityId: task.id,
        projectKey: task.humanKey.split('-')[0]!,
        entityTitle: task.title,
        detail: input.body,
      });
    }
    return comment;
  }
}
