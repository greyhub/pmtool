import { Injectable } from '@nestjs/common';
import { Comment, User } from '@prisma/client';
import { CreateCommentInput } from '@pmtool/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { toRichText } from './rich-text.util';

const COMMENT_INCLUDE = {
  author: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.db.comment.create({
      data: { organizationId, taskId, authorId, body: toRichText(input.body) },
      include: COMMENT_INCLUDE,
    });
  }
}
