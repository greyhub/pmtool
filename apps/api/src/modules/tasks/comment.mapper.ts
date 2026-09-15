import { Comment, User } from '@prisma/client';
import { CommentDto } from '@pmtool/shared-types';
import { fromRichText } from './rich-text.util';

type CommentWithAuthor = Comment & {
  author?: Pick<User, 'id' | 'fullName' | 'avatarUrl'>;
};

export function toCommentDto(comment: CommentWithAuthor): CommentDto {
  return {
    id: comment.id,
    taskId: comment.taskId,
    authorId: comment.authorId,
    author: comment.author
      ? {
          id: comment.author.id,
          fullName: comment.author.fullName,
          avatarUrl: comment.author.avatarUrl,
        }
      : undefined,
    body: fromRichText(comment.body) ?? '',
    createdAt: comment.createdAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() ?? null,
  };
}
