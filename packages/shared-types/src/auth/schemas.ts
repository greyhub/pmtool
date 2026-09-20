import { z } from 'zod';
import { LOCALES, MASCOT_CHARACTERS, THEME_PREFERENCES } from '../common/enums';

export const emailSchema = z.string().email().max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .max(128)
  .regex(/[a-z]/, 'Mật khẩu phải có chữ thường')
  .regex(/[A-Z]/, 'Mật khẩu phải có chữ hoa')
  .regex(/[0-9]/, 'Mật khẩu phải có số');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().min(1).max(120),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: emailSchema,
  fullName: z.string(),
  avatarUrl: z.string().url().nullable(),
  locale: z.enum(LOCALES),
  themePref: z.enum(THEME_PREFERENCES),
  mascotCharacter: z.enum(MASCOT_CHARACTERS),
  emailVerified: z.boolean(),
  createdAt: z.string(),
});
export type UserDto = z.infer<typeof userSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  user: userSchema,
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const updateUserPreferencesSchema = z.object({
  locale: z.enum(LOCALES).optional(),
  themePref: z.enum(THEME_PREFERENCES).optional(),
  mascotCharacter: z.enum(MASCOT_CHARACTERS).optional(),
});
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;

/** A mascot another member of one of my organizations already uses. */
export const takenCharacterSchema = z.object({
  character: z.enum(MASCOT_CHARACTERS),
  takenBy: z.string(),
});
export type TakenCharacterDto = z.infer<typeof takenCharacterSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Deleting an account needs the current password, so a stolen session cannot erase it. */
export const deleteAccountSchema = z.object({ password: z.string().min(1) });
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
