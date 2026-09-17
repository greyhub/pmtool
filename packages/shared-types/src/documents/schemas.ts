import { z } from 'zod';
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES } from '../common/enums';

export const createProjectDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  version: z.string().max(50).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  url: z.string().url(),
  ownerId: z.string().optional(),
  description: z.string().max(10_000).optional(),
});
export type CreateProjectDocumentInput = z.infer<typeof createProjectDocumentSchema>;

export const updateProjectDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  version: z.string().max(50).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  url: z.string().url().optional(),
  ownerId: z.string().nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
});
export type UpdateProjectDocumentInput = z.infer<typeof updateProjectDocumentSchema>;

const documentOwnerSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  avatarUrl: z.string().nullable(),
});

export const projectDocumentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  title: z.string(),
  category: z.enum(DOCUMENT_CATEGORIES),
  version: z.string(),
  status: z.enum(DOCUMENT_STATUSES),
  url: z.string(),
  ownerId: z.string().nullable(),
  owner: documentOwnerSchema.nullable().optional(),
  description: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectDocumentDto = z.infer<typeof projectDocumentSchema>;
