import { z } from 'zod';

export const telegramStatusSchema = z.object({
  linked: z.boolean(),
  dailyDigestEnabled: z.boolean(),
  dailyDigestHour: z.number().int().min(0).max(23),
});
export type TelegramStatusDto = z.infer<typeof telegramStatusSchema>;

export const updateTelegramDigestPreferencesSchema = z.object({
  dailyDigestEnabled: z.boolean(),
  dailyDigestHour: z.number().int().min(0).max(23),
});
export type UpdateTelegramDigestPreferencesInput = z.infer<
  typeof updateTelegramDigestPreferencesSchema
>;

export const telegramLinkCodeSchema = z.object({
  code: z.string(),
  deepLink: z.string(),
  expiresAt: z.string(),
});
export type TelegramLinkCodeDto = z.infer<typeof telegramLinkCodeSchema>;
