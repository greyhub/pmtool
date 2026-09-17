import { z } from 'zod';
import { ORG_ROLES, ORGANIZATION_STATUSES } from '../common/enums';

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
    })
    .optional(),
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

export const updateMembershipRoleSchema = z.object({
  role: z.enum(ORG_ROLES).exclude(['OWNER']),
});
export type UpdateMembershipRoleInput = z.infer<typeof updateMembershipRoleSchema>;
