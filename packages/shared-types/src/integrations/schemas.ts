import { z } from 'zod';

export const telegramStatusSchema = z.object({
  linked: z.boolean(),
});
export type TelegramStatusDto = z.infer<typeof telegramStatusSchema>;

export const telegramLinkCodeSchema = z.object({
  code: z.string(),
  deepLink: z.string(),
  expiresAt: z.string(),
});
export type TelegramLinkCodeDto = z.infer<typeof telegramLinkCodeSchema>;
