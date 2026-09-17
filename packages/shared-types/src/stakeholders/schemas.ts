import { z } from 'zod';
import { STAKEHOLDER_CATEGORIES, STAKEHOLDER_ENGAGEMENT_LEVELS, STAKEHOLDER_LEVELS } from '../common/enums';

export const createStakeholderSchema = z.object({
  userId: z.string().optional(),
  fullName: z.string().min(1).max(300),
  role: z.string().max(300).optional(),
  organizationName: z.string().max(300).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  category: z.enum(STAKEHOLDER_CATEGORIES).optional(),
  influence: z.enum(STAKEHOLDER_LEVELS).optional(),
  interest: z.enum(STAKEHOLDER_LEVELS).optional(),
  currentEngagement: z.enum(STAKEHOLDER_ENGAGEMENT_LEVELS).optional(),
  desiredEngagement: z.enum(STAKEHOLDER_ENGAGEMENT_LEVELS).optional(),
  notes: z.string().max(10_000).optional(),
});
export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;

export const updateStakeholderSchema = z.object({
  userId: z.string().nullable().optional(),
  fullName: z.string().min(1).max(300).optional(),
  role: z.string().max(300).nullable().optional(),
  organizationName: z.string().max(300).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  category: z.enum(STAKEHOLDER_CATEGORIES).optional(),
  influence: z.enum(STAKEHOLDER_LEVELS).optional(),
  interest: z.enum(STAKEHOLDER_LEVELS).optional(),
  currentEngagement: z.enum(STAKEHOLDER_ENGAGEMENT_LEVELS).optional(),
  desiredEngagement: z.enum(STAKEHOLDER_ENGAGEMENT_LEVELS).optional(),
  notes: z.string().max(10_000).nullable().optional(),
});
export type UpdateStakeholderInput = z.infer<typeof updateStakeholderSchema>;

const stakeholderUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const stakeholderSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  userId: z.string().nullable(),
  user: stakeholderUserSchema.nullable().optional(),
  fullName: z.string(),
  role: z.string().nullable(),
  organizationName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  category: z.enum(STAKEHOLDER_CATEGORIES),
  influence: z.enum(STAKEHOLDER_LEVELS),
  interest: z.enum(STAKEHOLDER_LEVELS),
  currentEngagement: z.enum(STAKEHOLDER_ENGAGEMENT_LEVELS),
  desiredEngagement: z.enum(STAKEHOLDER_ENGAGEMENT_LEVELS),
  notes: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StakeholderDto = z.infer<typeof stakeholderSchema>;
