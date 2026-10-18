import { z } from "zod";
import { badRequest } from "../../shared/errors.js";

const email = z.string().trim().toLowerCase().min(3).max(254).email("Enter a valid email address");

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/\d/, "Password must include a number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email,
  password,
});

export const passwordLoginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(128),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({
  token: z.string().min(20, "Reset token is invalid").max(200),
  password,
});

/** Throws a 400 with the first human-readable issue instead of a zod dump. */
export function parse(schema, payload) {
  const result = schema.safeParse(payload || {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw badRequest(issue?.message || "Invalid request", {
    field: issue?.path?.join("."),
  });
}
