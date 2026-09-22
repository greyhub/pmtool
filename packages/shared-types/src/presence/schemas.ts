import { z } from 'zod';
import { LOGIN_METHODS } from '../common/enums';

export const loginEventSchema = z.object({
  id: z.string(),
  method: z.enum(LOGIN_METHODS),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
  // Present only in an organization's own login history (an OWNER/ADMIN looking at their members),
  // absent from a user's own "Lịch sử đăng nhập" — they already know who they are.
  user: z
    .object({
      id: z.string(),
      fullName: z.string(),
      email: z.string(),
    })
    .optional(),
});
export type LoginEventDto = z.infer<typeof loginEventSchema>;
