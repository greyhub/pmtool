import { z } from 'zod';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from '../common/enums';

export const createFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().min(1).max(4000),
  pageUrl: z.string().max(500).optional(),
  // The org the sender was working in when they wrote it, for context only — kept even if that org is later deleted.
  organizationSlug: z.string().optional(),
});
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const updateFeedbackSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES).optional(),
  adminNote: z.string().max(4000).nullable().optional(),
});
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;

const feedbackAuthorSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
});

export const feedbackSchema = z.object({
  id: z.string(),
  userId: z.string(),
  user: feedbackAuthorSchema.nullable(),
  organizationId: z.string().nullable(),
  organizationName: z.string().nullable(),
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string(),
  pageUrl: z.string().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  adminNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FeedbackDto = z.infer<typeof feedbackSchema>;
