import * as z from "zod";

export const signupSchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(2, { error: "Name must be at least 2 characters." })
    .max(80, { error: "Name must be under 80 characters." }),
  email: z.email({ error: "Enter a valid email address." }),
  password: z
    .string({ error: "Password is required." })
    .min(8, { error: "Use at least 8 characters." })
    .max(128, { error: "Password must be under 128 characters." })
    .regex(/[a-zA-Z]/, { error: "Include at least one letter." })
    .regex(/[0-9]/, { error: "Include at least one number." }),
});

export const loginSchema = z.object({
  email: z.email({ error: "Enter a valid email address." }),
  password: z.string().min(1, { error: "Password is required." }).max(128),
});

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
