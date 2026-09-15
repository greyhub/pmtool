import { z } from 'zod';

export const createBoardColumnSchema = z.object({
  name: z.string().min(1).max(60),
  wipLimit: z.number().int().min(1).max(999).optional(),
});
export type CreateBoardColumnInput = z.infer<typeof createBoardColumnSchema>;

export const updateBoardColumnSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
  orderIndex: z.number().optional(),
});
export type UpdateBoardColumnInput = z.infer<typeof updateBoardColumnSchema>;

export const boardColumnSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  orderIndex: z.number(),
  wipLimit: z.number().nullable(),
});
export type BoardColumnDto = z.infer<typeof boardColumnSchema>;
