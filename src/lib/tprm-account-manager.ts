import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

export interface ProvisionAMResult {
  userId: string;
  created: boolean;
  fullName: string;
  userName: string;
}

/**
 * Ensure a login account exists for a vendor's Account Manager during vendor
 * onboarding.
 *
 *  - Username = the Account Manager name entered on the onboarding form (falls
 *    back to the AM email when no name was supplied); password = the one the
 *    BO/RM set while onboarding (hashed with bcrypt — no random generation).
 *  - The AM's `AccountManager` UserRole is created (tagged moduleCode "TPRM") so
 *    the account can log in and land in the TPRM workspace.
 *  - Email is globally unique, so the lookup is app-wide: if an AM identity
 *    already has an account anywhere (AM-to-AM reuse across vendors/customers),
 *    it is returned as-is with `created: false` and the password is NOT changed.
 *
 * Returns `null` when the email is empty, or when the AM doesn't exist yet and no
 * password was provided (can't create a login without one).
 */
export async function provisionAccountManagerUser(
  customerAccountId: string,
  params: { email: string | null | undefined; name?: string | null; password?: string | null },
): Promise<ProvisionAMResult | null> {
  const email = (params.email || "").split(";")[0].trim();
  if (!email) return null;

  // Email is @unique app-wide — look up without tenant scope so cross-customer
  // AM reuse doesn't hit the unique constraint on create.
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, fullName: true, userName: true },
  });
  if (existing) {
    return { userId: existing.id, created: false, fullName: existing.fullName, userName: existing.userName };
  }

  if (!params.password) return null; // no password set during onboarding — can't create a login.

  const hashedPassword = await bcrypt.hash(params.password, 10);
  const userCount = await prisma.user.count({ where: { customerAccountId } });
  const userId = `TPRM_${customerAccountId.substring(0, 6)}_${String(userCount + 1).padStart(3, "0")}`;

  // Mirror the email selection: only the first AM (matching the first email
  // above) is provisioned, so take just the first name segment — not the whole
  // "name1; name2" join that the form sends when multiple AMs are added.
  const fullName = (params.name || "").split(";")[0].trim() || email;
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const lastName = fullName.split(/\s+/).slice(1).join(" ") || "-";

  const user = await prisma.user.create({
    data: {
      userId,
      customerAccountId,
      fullName,
      firstName,
      lastName,
      email,
      userName: fullName, // username = the AM name entered on the onboarding form
      password: hashedPassword,
      tprmRole: "Account Manager",
      tprmFunctionCategory: "Account Manager",
      isActive: true,
    },
    select: { id: true, fullName: true, userName: true },
  });

  // Assign the AccountManager system role, tagged to the TPRM module.
  const role = await prisma.role.upsert({
    where: { name: "AccountManager" },
    update: {},
    create: { name: "AccountManager", description: "TPRM Account Manager role", isSystem: true },
  });
  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, moduleCode: "TPRM" },
  });

  return { userId: user.id, created: true, fullName: user.fullName, userName: user.userName };
}
