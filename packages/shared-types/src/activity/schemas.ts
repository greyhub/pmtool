import { z } from 'zod';

const activityActorSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const activityLogSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  actor: activityActorSchema,
  createdAt: z.string(),
});
export type ActivityLogDto = z.infer<typeof activityLogSchema>;
