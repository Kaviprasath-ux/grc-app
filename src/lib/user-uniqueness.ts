/**
 * Phase 10 — global uniqueness pre-checks for user creation.
 *
 * userName and email are globally unique across the whole system (enforced
 * at the DB level via @unique on User.userName and User.email). This helper
 * lets every create-user endpoint surface a friendly 409 BEFORE the insert
 * hits the unique violation.
 *
 * Used by:
 *   - POST /api/users
 *   - POST /api/tprm/user-management
 *   - POST /api/grc/customer-accounts/onboard
 *   - POST /api/public/signup (and variants)
 *
 * Error messages are deliberately neutral — they don't say which customer
 * the existing user belongs to (tenant data leakage).
 */
import prisma from "@/lib/prisma";

export type UniquenessResult =
  | { ok: true }
  | {
      ok: false;
      /** "username" or "email" — used by callers to set the field-specific error */
      field: "userName" | "email";
      message: string;
    };

/**
 * Reject if userName OR email is taken anywhere (any customer).
 * Optionally pass excludeUserId to allow updating the same row (PUT path).
 */
export async function assertUserGloballyUnique(opts: {
  userName?: string | null;
  email?: string | null;
  excludeUserId?: string;
}): Promise<UniquenessResult> {
  const { userName, email, excludeUserId } = opts;

  if (userName) {
    const taken = await prisma.user.findFirst({
      where: {
        userName: { equals: userName, mode: "insensitive" },
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      return {
        ok: false,
        field: "userName",
        message: "This username is already in use. Please choose a different one.",
      };
    }
  }

  if (email) {
    const taken = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (taken) {
      return {
        ok: false,
        field: "email",
        message: "This email is already in use. Please choose a different one.",
      };
    }
  }

  return { ok: true };
}
