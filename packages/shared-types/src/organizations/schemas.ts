import { z } from 'zod';
import {
  JOIN_REQUEST_STATUSES,
  MASCOT_CHARACTERS,
  ORG_ROLES,
  ORGANIZATION_STATUSES,
} from '../common/enums';

const slugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang');

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(120),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: slugSchema,
  status: z.enum(ORGANIZATION_STATUSES),
  createdAt: z.string(),
});
export type OrganizationDto = z.infer<typeof organizationSchema>;

export const membershipSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.enum(ORG_ROLES),
  user: z
    .object({
      id: z.string(),
      email: z.string().email(),
      fullName: z.string(),
      avatarUrl: z.string().url().nullable(),
      mascotCharacter: z.enum(MASCOT_CHARACTERS),
    })
    .optional(),
  lastActiveAt: z.string().nullable(),
  /** Active within the last few minutes — computed server-side so every viewer agrees on the same cutoff. */
  online: z.boolean(),
});
export type MembershipDto = z.infer<typeof membershipSchema>;

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).exclude(['OWNER']),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/** OWNER is grantable, but only by an Owner (enforced in MembershipsService). */
export const updateMembershipRoleSchema = z.object({
  role: z.enum(ORG_ROLES),
});
export type UpdateMembershipRoleInput = z.infer<typeof updateMembershipRoleSchema>;

export const createJoinRequestSchema = z.object({
  message: z.string().max(500).optional(),
});
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;

export const decideJoinRequestSchema = z.object({
  role: z.enum(ORG_ROLES).exclude(['OWNER']),
});
export type DecideJoinRequestInput = z.infer<typeof decideJoinRequestSchema>;

export const joinRequestSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  userId: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
    avatarUrl: z.string().nullable(),
    mascotCharacter: z.enum(MASCOT_CHARACTERS),
  }),
  message: z.string().nullable(),
  status: z.enum(JOIN_REQUEST_STATUSES),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type JoinRequestDto = z.infer<typeof joinRequestSchema>;
