import { z } from 'zod';
import { PROJECT_STATUSES } from '../common/enums';

export const projectKeySchema = z
  .string()
  .min(2)
  .max(10)
  .regex(/^[A-Z][A-Z0-9]*$/, 'Mã dự án chỉ gồm chữ hoa và số, bắt đầu bằng chữ cái');

export const createProjectSchema = z.object({
  key: projectKeySchema,
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  key: projectKeySchema,
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(PROJECT_STATUSES),
  startDate: z.string().nullable(),
  targetEndDate: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectDto = z.infer<typeof projectSchema>;
