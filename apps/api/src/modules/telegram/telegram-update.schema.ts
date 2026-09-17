import { z } from 'zod';

/**
 * Lenient/passthrough on purpose — this validates Telegram's own webhook
 * payload (not a PMTool API contract, so it doesn't belong in
 * packages/shared-types), and we only care about a couple of fields out of
 * a much larger, evolving shape Telegram controls.
 */
export const telegramUpdateSchema = z
  .object({
    message: z
      .object({
        text: z.string().optional(),
        chat: z.object({ id: z.number() }),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
