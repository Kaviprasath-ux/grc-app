import prisma from "@/lib/prisma";

/**
 * Global email-collision check for vendor Account Manager identities.
 *
 * Background:
 *   The User table enforces `email @unique` at the DB level. An email can
 *   therefore exist as at most one User row anywhere in the application,
 *   regardless of which customer's tenant owns that row.
 *
 *   When a vendor is onboarded under customer A using an AM email that
 *   already belongs to a User under customer B, the cross-tenant overlap
 *   isn't visible to A's admin in the UI — but downstream logic (assessment
 *   notification lookups, AM auto-provisioning during bulk import) WILL
 *   find that single global user row and treat the same person as both an
 *   Account Manager for A and whatever role they hold under B. The rule
 *   below blocks that at write time.
 *
 * Rule:
 *   For each AM email submitted, look up the corresponding User row across
 *   the WHOLE app (no customerAccountId scope). If the email already
 *   resolves to a user and that user's `tprmRole` is anything other than
 *   "Account Manager", reject. AM-to-AM reuse remains allowed because a
 *   single vendor-side AM identity can legitimately handle multiple
 *   vendors across multiple customers.
 */

export type AccountManagerEmailCheck =
  | { ok: true }
  | {
      ok: false;
      conflict: { email: string; fullName: string; tprmRole: string | null };
      message: string;
    };

/**
 * Split a vendor's `accountManagerEmail` field (semicolon-separated) into a
 * normalized list of distinct emails. Empty / whitespace entries are dropped.
 */
export function parseAccountManagerEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(";")) {
    const e = part.trim().toLowerCase();
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

/**
 * Verify none of the provided AM emails already belong to a user with a
 * non-AM role anywhere in the app. AM ↔ AM collisions are intentionally
 * allowed.
 *
 * Returns `{ ok: true }` when clear, or `{ ok: false, ... }` with the first
 * offending user so the calling API route can return a useful 409.
 *
 * The `customerAccountId` parameter is intentionally unused — kept on the
 * signature so existing call sites need no change, and so future tweaks can
 * reintroduce a tenant-aware exemption (e.g. allow internal cross-role
 * within a single tenant) without another API churn.
 */
export async function validateAccountManagerEmails(
  _customerAccountId: string,
  accountManagerEmail: string | null | undefined
): Promise<AccountManagerEmailCheck> {
  const emails = parseAccountManagerEmails(accountManagerEmail);
  if (emails.length === 0) return { ok: true };

  const matches = await prisma.user.findMany({
    where: {
      email: { in: emails, mode: "insensitive" },
    },
    select: { email: true, fullName: true, tprmRole: true, role: true },
  });

  for (const m of matches) {
    if (m.tprmRole === "Account Manager") continue; // AM-to-AM reuse allowed.

    // Anyone else with this email — whatever role they hold — is a collision.
    const roleLabel = m.tprmRole ?? m.role ?? "user";
    return {
      ok: false,
      conflict: { email: m.email, fullName: m.fullName, tprmRole: m.tprmRole },
      message: `${m.email} is already registered as ${roleLabel} (${m.fullName}). Only Account Manager identities can be reused — please use a different email, or change that user's role first.`,
    };
  }

  return { ok: true };
}
