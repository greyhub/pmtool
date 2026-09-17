import { z } from 'zod';
import { ORG_ROLES, PROJECT_STATUSES } from '../common/enums';

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

export const projectMemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
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
  createdAt: z.string(),
});
export type ProjectMemberDto = z.infer<typeof projectMemberSchema>;

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ORG_ROLES),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const updateProjectMemberRoleSchema = z.object({
  role: z.enum(ORG_ROLES),
});
export type UpdateProjectMemberRoleInput = z.infer<typeof updateProjectMemberRoleSchema>;
