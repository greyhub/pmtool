import { z } from 'zod';
import { CHARTER_STATUSES } from '../common/enums';

export const upsertCharterSchema = z.object({
  purpose: z.string().max(20_000).optional(),
  objectives: z.string().max(20_000).optional(),
  scopeSummary: z.string().max(20_000).optional(),
  milestonesSummary: z.string().max(20_000).optional(),
  budgetSummary: z.string().max(2_000).optional(),
  assumptions: z.string().max(20_000).optional(),
  constraints: z.string().max(20_000).optional(),
  sponsorName: z.string().max(300).optional(),
  projectManagerId: z.string().optional(),
});
export type UpsertCharterInput = z.infer<typeof upsertCharterSchema>;

const charterUserSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const projectCharterSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  purpose: z.string().nullable(),
  objectives: z.string().nullable(),
  scopeSummary: z.string().nullable(),
  milestonesSummary: z.string().nullable(),
  budgetSummary: z.string().nullable(),
  assumptions: z.string().nullable(),
  constraints: z.string().nullable(),
  sponsorName: z.string().nullable(),
  projectManagerId: z.string().nullable(),
  projectManager: charterUserSchema.nullable().optional(),
  status: z.enum(CHARTER_STATUSES),
  approvedById: z.string().nullable(),
  approvedBy: charterUserSchema.nullable().optional(),
  approvedAt: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectCharterDto = z.infer<typeof projectCharterSchema>;
