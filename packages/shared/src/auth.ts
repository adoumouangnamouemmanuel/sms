import { z } from 'zod';

export const AUTH_USER_ROLES = ['SCHOOL_MASTER', 'TEACHER'] as const;
export type AuthUserRole = (typeof AUTH_USER_ROLES)[number];

export function isAuthUserRole(value: unknown): value is AuthUserRole {
  return typeof value === 'string' && (AUTH_USER_ROLES as readonly string[]).includes(value);
}

export const publicAuthUserSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  username: z.string().min(1),
  role: z.enum(AUTH_USER_ROLES),
});

export const loginRequestSchema = z.object({
  schoolCode: z.string().trim().min(1).max(64),
  username: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(256),
  deviceName: z.string().trim().min(1).max(120).optional(),
});

export const refreshSessionRequestSchema = z.object({});

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});

export const resetPasswordRequestSchema = z.object({
  newPassword: z.string().min(8).max(256),
});

export const authTokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshTokenExpiresAt: z.iso.datetime(),
  user: publicAuthUserSchema,
});

export type PublicAuthUser = z.infer<typeof publicAuthUserSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type AuthTokenResponse = z.infer<typeof authTokenResponseSchema>;
