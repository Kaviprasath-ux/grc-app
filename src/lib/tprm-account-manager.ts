import prisma from "@/lib/prisma";

/**
 * Roles that disqualify a user from being assigned as a vendor's Account Manager.
 * An Account Manager is a vendor-facing identity that one or many vendors can
 * share; staff roles below are internal TPRM personnel and must not be reused
 * as AM identities, otherwise the same person ends up with cross-cutting
 * permissions (e.g. an Approver also acting as AM for "their own" vendor).
 */
const RESTRICTED_TPRM_ROLES = new Set<string>([
  "Approver",
  "Assessor",
  "Auditor",
  "BusinessOwner",
  "RelationshipManager",
  "InternalITTeam",
]);

export type AccountManagerEmailCheck =
  | { ok: true }
  | {
      ok: false;
      conflict: { email: string; fullName: string; tprmRole: string };
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
 * Ensure none of the provided Account Manager emails belong to an existing
 * TPRM staff user (Approver, Assessor, Auditor, BO, RM, Internal IT Team).
 *
 * Account-Manager-to-Account-Manager reuse is intentionally allowed: a single
 * AM can manage multiple vendors. Users with no `tprmRole` set (e.g. customer
 * admins, fresh accounts) are also allowed since they aren't TPRM staff.
 *
 * Returns `{ ok: true }` when clear, or `{ ok: false, ... }` with the first
 * offending user so the API can return a useful 409 to the form.
 */
export async function validateAccountManagerEmails(
  customerAccountId: string,
  accountManagerEmail: string | null | undefined
): Promise<AccountManagerEmailCheck> {
  const emails = parseAccountManagerEmails(accountManagerEmail);
  if (emails.length === 0) return { ok: true };

  const matches = await prisma.user.findMany({
    where: {
      customerAccountId,
      email: { in: emails, mode: "insensitive" },
      tprmRole: { not: null },
    },
    select: { email: true, fullName: true, tprmRole: true },
  });

  for (const m of matches) {
    if (m.tprmRole && RESTRICTED_TPRM_ROLES.has(m.tprmRole)) {
      return {
        ok: false,
        conflict: { email: m.email, fullName: m.fullName, tprmRole: m.tprmRole },
        message: `${m.email} is already registered as ${m.tprmRole} (${m.fullName}). TPRM staff cannot be reused as an Account Manager — please use a different email, or change that user's role first.`,
      };
    }
  }

  return { ok: true };
}
