import { z } from 'zod';

const MAX_HTML_LENGTH = 200_000;

export const createArtifactSchema = z.object({
  title: z.string().min(1).max(300),
  htmlContent: z.string().max(MAX_HTML_LENGTH).optional(),
});
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

export const updateArtifactSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  htmlContent: z.string().max(MAX_HTML_LENGTH).optional(),
});
export type UpdateArtifactInput = z.infer<typeof updateArtifactSchema>;

/** List payload — deliberately omits htmlContent, which can be up to 200,000 chars. */
export const artifactSummarySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string(),
  title: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ArtifactSummaryDto = z.infer<typeof artifactSummarySchema>;

/** Single-get payload — includes the full content. */
export const artifactDetailSchema = artifactSummarySchema.extend({
  htmlContent: z.string(),
});
export type ArtifactDetailDto = z.infer<typeof artifactDetailSchema>;
