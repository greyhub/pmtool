import { Prisma } from '@prisma/client';

/**
 * Task.description / Comment.body are stored as a small JSON doc (not a
 * plain string) so richer content — and later, AI parsing of it — doesn't
 * require a migration. Phase 1's UI only edits plain text, so the shape is
 * intentionally minimal for now: `{ type: 'text', content: string }`.
 */
export function toRichText(content: string): Prisma.InputJsonValue {
  return { type: 'text', content };
}

export function fromRichText(
  value: Prisma.JsonValue | null | undefined,
): string | null {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { content?: unknown }).content === 'string'
  ) {
    return (value as { content: string }).content;
  }
  return null;
}
