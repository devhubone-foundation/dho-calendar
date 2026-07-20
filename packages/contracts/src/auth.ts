import { z } from "zod";

export const userRoleSchema = z.enum(["MEMBER", "ADMIN"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .toLowerCase()
  .email("Enter a valid email address");

export const newPasswordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200, "Password must be at most 200 characters");

export const authenticatedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: userRoleSchema,
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
});
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  user: authenticatedUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  user: authenticatedUserSchema,
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: newPasswordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const meResponseSchema = authenticatedUserSchema;
export type MeResponse = z.infer<typeof meResponseSchema>;
