import { z } from 'zod';
import { RISK_ISSUE_TYPES, RISK_STATUSES } from '../common/enums';

export const createRiskIssueSchema = z.object({
  type: z.enum(RISK_ISSUE_TYPES),
  title: z.string().min(1).max(300),
  description: z.string().max(20_000).optional(),
  probability: z.number().int().min(1).max(5).optional(),
  impact: z.number().int().min(1).max(5).optional(),
  status: z.enum(RISK_STATUSES).optional(),
  ownerId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreateRiskIssueInput = z.infer<typeof createRiskIssueSchema>;

export const updateRiskIssueSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20_000).nullable().optional(),
  probability: z.number().int().min(1).max(5).nullable().optional(),
  impact: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(RISK_STATUSES).optional(),
  ownerId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});
export type UpdateRiskIssueInput = z.infer<typeof updateRiskIssueSchema>;

const riskIssueOwnerSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const riskIssueSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  type: z.enum(RISK_ISSUE_TYPES),
  title: z.string(),
  description: z.string().nullable(),
  probability: z.number().nullable(),
  impact: z.number().nullable(),
  severityScore: z.number().nullable(),
  status: z.enum(RISK_STATUSES),
  ownerId: z.string().nullable(),
  owner: riskIssueOwnerSchema.nullable().optional(),
  dueDate: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RiskIssueDto = z.infer<typeof riskIssueSchema>;
