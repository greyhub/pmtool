import { z } from 'zod';
import { CHARTER_STATUSES, DELIVERABLE_STATUSES, WBS_NODE_TYPES } from '../common/enums';

// ---- Project scope statement -------------------------------------------------

export const upsertScopeSchema = z.object({
  inScope: z.string().max(20_000).optional(),
  outOfScope: z.string().max(20_000).optional(),
  deliverablesSummary: z.string().max(20_000).optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
  assumptions: z.string().max(20_000).optional(),
  constraints: z.string().max(20_000).optional(),
});
export type UpsertScopeInput = z.infer<typeof upsertScopeSchema>;

export const projectScopeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  inScope: z.string().nullable(),
  outOfScope: z.string().nullable(),
  deliverablesSummary: z.string().nullable(),
  acceptanceCriteria: z.string().nullable(),
  assumptions: z.string().nullable(),
  constraints: z.string().nullable(),
  status: z.enum(CHARTER_STATUSES),
  approvedById: z.string().nullable(),
  approvedByName: z.string().nullable(),
  approvedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type ProjectScopeDto = z.infer<typeof projectScopeSchema>;

// ---- WBS dictionary ----------------------------------------------------------

export const upsertWbsDictionarySchema = z.object({
  scopeDescription: z.string().max(20_000).optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
  assumptions: z.string().max(20_000).optional(),
  constraints: z.string().max(20_000).optional(),
  requiredResources: z.string().max(2_000).optional(),
  qualityRequirements: z.string().max(2_000).optional(),
  technicalReferences: z.string().max(2_000).optional(),
  costEstimate: z.number().min(0).max(1e12).nullable().optional(),
});
export type UpsertWbsDictionaryInput = z.infer<typeof upsertWbsDictionarySchema>;

export const wbsDictionarySchema = z.object({
  taskId: z.string(),
  scopeDescription: z.string().nullable(),
  acceptanceCriteria: z.string().nullable(),
  assumptions: z.string().nullable(),
  constraints: z.string().nullable(),
  requiredResources: z.string().nullable(),
  qualityRequirements: z.string().nullable(),
  technicalReferences: z.string().nullable(),
  costEstimate: z.number().nullable(),
  updatedAt: z.string(),
});
export type WbsDictionaryDto = z.infer<typeof wbsDictionarySchema>;

// ---- Scope map (dashboard linkage diagram) ----------------------------------

export const SCOPE_MAP_NODE_KINDS = ['charter', 'scope', ...WBS_NODE_TYPES, 'milestone', 'deliverableRecord'] as const;
export type ScopeMapNodeKind = (typeof SCOPE_MAP_NODE_KINDS)[number];

export const scopeMapNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(SCOPE_MAP_NODE_KINDS),
  label: z.string(),
  /** WBS code, for task-backed nodes. */
  code: z.string().nullable(),
  taskId: z.string().nullable(),
  status: z.string().nullable(),
  progress: z.number().nullable(),
  /** True for a WBS element that has a filled-in dictionary entry. */
  hasDictionary: z.boolean(),
});
export type ScopeMapNode = z.infer<typeof scopeMapNodeSchema>;

export const scopeMapEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(['contains', 'produces', 'depends']),
});
export type ScopeMapEdge = z.infer<typeof scopeMapEdgeSchema>;

export const COVERAGE_CHECK_KEYS = [
  'workPackageWithoutActivity',
  'workPackageWithoutDictionary',
  'deliverableWithoutCriteria',
  'deliverableWithoutRecord',
  'activityOutsideWorkPackage',
  'milestoneWithoutDeliverable',
  'singleChildParent',
] as const;
export type CoverageCheckKey = (typeof COVERAGE_CHECK_KEYS)[number];

export const coverageCheckSchema = z.object({
  key: z.enum(COVERAGE_CHECK_KEYS),
  /** Node ids (task ids) that fail the check. */
  offenders: z.array(z.string()),
  total: z.number(),
});
export type CoverageCheck = z.infer<typeof coverageCheckSchema>;

export const scopeMapSchema = z.object({
  nodes: z.array(scopeMapNodeSchema),
  edges: z.array(scopeMapEdgeSchema),
  checks: z.array(coverageCheckSchema),
  scopeStatus: z.enum(CHARTER_STATUSES).nullable(),
  charterStatus: z.enum(CHARTER_STATUSES).nullable(),
  deliverableStatuses: z.record(z.enum(DELIVERABLE_STATUSES), z.number()),
});
export type ScopeMapDto = z.infer<typeof scopeMapSchema>;
