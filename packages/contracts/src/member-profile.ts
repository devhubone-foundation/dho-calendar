import { z } from "zod";

import { emailSchema, newPasswordSchema, userRoleSchema } from "./auth";

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Full name is required")
  .max(200, "Full name must be at most 200 characters");

export const qualificationTextSchema = z
  .string()
  .trim()
  .min(1, "Qualification is required")
  .max(200, "Qualification must be at most 200 characters");

/** Combined account + profile view returned by /api/me/profile and /api/users/*. */
export const memberSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  role: userRoleSchema,
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  fullName: z.string(),
  qualificationBg: z.string(),
  qualificationEn: z.string(),
  profileImagePath: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MemberSummary = z.infer<typeof memberSummarySchema>;

export const memberListResponseSchema = z.object({
  members: z.array(memberSummarySchema),
});
export type MemberListResponse = z.infer<typeof memberListResponseSchema>;

export const memberResponseSchema = memberSummarySchema;
export type MemberResponse = z.infer<typeof memberResponseSchema>;

/** PATCH /api/me/profile — a member editing their own profile. */
export const selfProfileUpdateRequestSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  qualificationBg: qualificationTextSchema,
  qualificationEn: qualificationTextSchema,
});
export type SelfProfileUpdateRequest = z.infer<typeof selfProfileUpdateRequestSchema>;

/** POST /api/users — admin creates a member account with a temporary password. */
export const adminCreateMemberRequestSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  qualificationBg: qualificationTextSchema,
  qualificationEn: qualificationTextSchema,
  role: userRoleSchema,
  temporaryPassword: newPasswordSchema,
});
export type AdminCreateMemberRequest = z.infer<typeof adminCreateMemberRequestSchema>;

/** PATCH /api/users/:id — admin edits an existing member's account/profile fields. */
export const adminUpdateMemberRequestSchema = z.object({
  email: emailSchema,
  fullName: fullNameSchema,
  qualificationBg: qualificationTextSchema,
  qualificationEn: qualificationTextSchema,
  role: userRoleSchema,
});
export type AdminUpdateMemberRequest = z.infer<typeof adminUpdateMemberRequestSchema>;

/** PATCH /api/users/:id/status — admin activates or deactivates a member. */
export const memberStatusUpdateRequestSchema = z.object({
  isActive: z.boolean(),
});
export type MemberStatusUpdateRequest = z.infer<typeof memberStatusUpdateRequestSchema>;
