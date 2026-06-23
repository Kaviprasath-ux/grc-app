import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus, SubscriptionType } from "@prisma/client";
import { expandRolePermissions, type UserPermission } from "@/lib/permissions";
import { getAccessSnapshot } from "@/lib/module-access";

// Shared query for loading user with all relations needed for session
const userSelect = {
  id: true,
  fullName: true,
  email: true,
  password: true,
  userName: true,
  isActive: true,
  isBlocked: true,
  departmentId: true,
  auditHeadId: true,
  customerAccountId: true,
  tprmRole: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  customerAccount: {
    select: {
      id: true,
      code: true,
      name: true,
      // logoUrl intentionally NOT selected — it can be a base64 data URL tens of
      // KB long; stuffing it into the JWT blows up the Set-Cookie header and
      // trips nginx's proxy_buffer_size limit (→ 502 at the reverse proxy with
      // no app-side error). The logo is fetched on demand via /api/settings/logo.
      isGrcAdded: true,
      isTprmAdded: true,
      isInternalAuditEnabled: true,
      isTechnicalEvidenceEnabled: true,
      isQpostComplianceEnabled: true,
    },
  },
  auditHead: { select: { id: true, fullName: true } },
  userRoles: {
    include: {
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

// Map tprmRole field values to RBAC system role names
const TPRM_ROLE_TO_SYSTEM_ROLE: Record<string, string> = {
  'Business Owner': 'BusinessOwner',
  'Relationship Manager': 'RelationshipManager',
  'Assessor': 'TPRMAssessor',
  'Approver': 'TPRMApprover',
  'Auditor': 'TPRMAuditor',
  'Account Manager': 'AccountManager',
  'SME': 'TPRMSME',
};

// Auto-repair: if user has tprmRole but no matching UserRole, create it on login
async function ensureTprmUserRole(userId: string, tprmRole: string | null, existingRoleNames: string[]) {
  if (!tprmRole) return;
  const systemRoleName = TPRM_ROLE_TO_SYSTEM_ROLE[tprmRole];
  if (!systemRoleName) return;
  // Already has the correct role
  if (existingRoleNames.includes(systemRoleName)) return;
  try {
    const role = await prisma.role.upsert({
      where: { name: systemRoleName },
      update: {},
      create: { name: systemRoleName, description: `TPRM ${tprmRole} role`, isSystem: true },
    });
    // TPRM auto-repair: this assignment is always module-scoped to TPRM.
    await prisma.userRole.upsert({
      where: { userId_roleId_moduleCode: { userId, roleId: role.id, moduleCode: "TPRM" } },
      create: { userId, roleId: role.id, moduleCode: "TPRM" },
      update: {},
    });
  } catch {
    // Non-fatal — log and continue
    console.error(`[AUTH] Failed to auto-assign ${systemRoleName} role for user ${userId}`);
  }
}

// Helper to build the user object returned to NextAuth from a DB user.
// Async because, when SUBSCRIPTION_GATING_ENABLED=true, it queries the new
// Subscription/ModuleSubscription tables to derive module access flags from
// real subscription state instead of the legacy CustomerAccount booleans.
async function buildAuthUser(dbUser: {
  id: string;
  fullName: string;
  email: string;
  tprmRole?: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  customerAccountId: string | null;
  customerAccount: { id: string; code: string; name: string; isGrcAdded: boolean; isTprmAdded: boolean; isInternalAuditEnabled: boolean; isTechnicalEvidenceEnabled: boolean; isQpostComplianceEnabled: boolean } | null;
  auditHeadId: string | null;
  userRoles: { moduleCode: string | null; role: { id: string; name: string } }[];
}, extraRoles?: string[], extraRoleModules?: Array<"GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE">) {
  const roleNames = dbUser.userRoles.map(ur => ur.role.name);
  if (extraRoles) roleNames.push(...extraRoles.filter(r => !roleNames.includes(r)));
  const effectiveRoles = roleNames.length > 0 ? roleNames : ['Contributor'];
  const primaryRole = effectiveRoles[0] || 'Contributor';

  // Phase 5b.1: distinct module codes the user holds at least one role in.
  // Drives the workspace picker (subscription ∩ has-role). System roles
  // (moduleCode=null) are excluded — they don't anchor to any module.
  //
  // extraRoleModules is the auto-provision companion to extraRoles. Callers
  // pass it when ensureTprmUserRole has just inserted a UserRole row that
  // isn't reflected in the cached dbUser.userRoles array — without it, the
  // first-login JWT sees roleModules=[] and the layout gate redirects to
  // /select-module ("no active workspaces"). Second login works because
  // the DB row is found this time.
  const validModules = new Set<"GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE">();
  for (const ur of dbUser.userRoles) {
    if (ur.moduleCode === "GRC" || ur.moduleCode === "TPRM" || ur.moduleCode === "INTERNAL_AUDIT" || ur.moduleCode === "TECHNICAL_EVIDENCE") {
      validModules.add(ur.moduleCode);
    }
  }
  if (extraRoleModules) {
    for (const m of extraRoleModules) validModules.add(m);
  }
  const roleModules = Array.from(validModules);

  // Module access is derived from current Subscription / ModuleSubscription
  // state via getAccessSnapshot. The CustomerAccount.is* booleans are used
  // only as a defensive fallback when the subscription read fails.
  let isGrcAdded = dbUser.customerAccount?.isGrcAdded ?? false;
  let isTprmAdded = dbUser.customerAccount?.isTprmAdded ?? false;
  let isInternalAuditEnabled = dbUser.customerAccount?.isInternalAuditEnabled ?? false;
  let isTechnicalEvidenceEnabled = dbUser.customerAccount?.isTechnicalEvidenceEnabled ?? false;
  let subscriptionStatus: SubscriptionStatus | null = null;
  let subscriptionType: SubscriptionType | null = null;

  if (dbUser.customerAccountId) {
    try {
      const snap = await getAccessSnapshot(dbUser.customerAccountId);
      isGrcAdded = snap.isGrcAdded;
      isTprmAdded = snap.isTprmAdded;
      isInternalAuditEnabled = snap.isInternalAuditEnabled;
      isTechnicalEvidenceEnabled = snap.isTechnicalEvidenceEnabled;
      subscriptionStatus = snap.subscriptionStatus;
      subscriptionType = snap.subscriptionType;
    } catch (e) {
      // Defensive: if subscription read fails, fall back to legacy flags so login still works.
      console.error('[AUTH] getAccessSnapshot failed, falling back to legacy flags:', e);
    }
  }

  return {
    id: dbUser.id,
    name: dbUser.fullName,
    email: dbUser.email,
    role: primaryRole,
    department: dbUser.department?.name || '',
    departmentId: dbUser.departmentId,
    departmentName: dbUser.department?.name || null,
    customerAccountId: dbUser.customerAccountId,
    customerAccountCode: dbUser.customerAccount?.code || null,
    customerAccountName: dbUser.customerAccount?.name || null,
    auditHeadId: dbUser.auditHeadId,
    isGrcAdded,
    isTprmAdded,
    isInternalAuditEnabled,
    isTechnicalEvidenceEnabled,
    isQpostComplianceEnabled: dbUser.customerAccount?.isQpostComplianceEnabled ?? false,
    subscriptionStatus,
    subscriptionType,
    roles: effectiveRoles,
    roleModules,
    permissions: [] as UserPermission[],
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Host-authjs.csrf-token"
        : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log('[AUTH] Login attempt:', credentials?.username);

        if (!credentials?.username || !credentials?.password) {
          console.log('[AUTH] Missing credentials');
          return null;
        }

        try {
        // Find user in database — username/email match is case-insensitive
        // so users aren't forced to reproduce the exact case they registered with.
        const identifier = credentials.username as string;
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { userName: { equals: identifier, mode: "insensitive" } },
              { email: { equals: identifier, mode: "insensitive" } },
            ],
            isActive: true,
            isBlocked: false,
          },
          select: userSelect,
        });

        if (!user) {
          console.log('[AUTH] User not found');
          return null;
        }

        console.log('[AUTH] User found:', user.userName, 'isActive:', user.isActive, 'isBlocked:', user.isBlocked);

        // SSO-only user cannot login via credentials
        if (!user.password) {
          console.log('[AUTH] SSO-only user attempted credentials login');
          return null;
        }

        // Compare password using bcrypt
        const inputPassword = String(credentials.password);
        const isValidPassword = await bcrypt.compare(inputPassword, user.password);
        if (!isValidPassword) {
          console.log('[AUTH] Password mismatch');
          return null;
        }

        console.log('[AUTH] Login successful for:', user.userName);

        // Auto-repair: ensure TPRM users have their system role assigned.
        // When ensureTprmUserRole inserts a fresh UserRole row, the cached
        // user.userRoles array doesn't reflect it — so we also tell
        // buildAuthUser to add "TPRM" to roleModules. Without this companion
        // hint, first login produced an empty availableModules and the
        // layout gate kicked the user to /select-module ("no workspaces"),
        // and only the second login succeeded.
        const existingRoleNames = user.userRoles.map(ur => ur.role.name);
        const tprmSystemRole = user.tprmRole ? TPRM_ROLE_TO_SYSTEM_ROLE[user.tprmRole] : null;
        let extraRoles: string[] | undefined;
        let extraRoleModules: Array<"GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE"> | undefined;
        if (tprmSystemRole && !existingRoleNames.includes(tprmSystemRole)) {
          await ensureTprmUserRole(user.id, user.tprmRole, existingRoleNames);
          extraRoles = [tprmSystemRole];
          extraRoleModules = ["TPRM"];
        }

        return await buildAuthUser(user, extraRoles, extraRoleModules);
        } catch (error) {
          console.error('[AUTH] Error during authentication:', error);
          return null;
        }
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Credentials flow: authorize() already validated the user
      if (account?.provider === "credentials") {
        return true;
      }

      // OAuth flow: verify user is pre-registered
      const email = user.email;
      if (!email) {
        console.log('[AUTH-SSO] No email provided by OAuth provider');
        return "/login?error=NoEmail";
      }

      try {
        const dbUser = await prisma.user.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
            isActive: true,
            isBlocked: false,
          },
        });

        if (!dbUser) {
          console.log('[AUTH-SSO] User not registered:', email);
          return "/login?error=UserNotRegistered";
        }

        // Upsert OAuth account record for audit trail
        await prisma.oAuthAccount.upsert({
          where: {
            provider_providerAccountId: {
              provider: account!.provider,
              providerAccountId: account!.providerAccountId!,
            },
          },
          create: {
            userId: dbUser.id,
            provider: account!.provider,
            providerAccountId: account!.providerAccountId!,
            email: email,
          },
          update: {
            email: email,
            updatedAt: new Date(),
          },
        });

        // Update last login
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { lastLogin: new Date() },
        });

        console.log('[AUTH-SSO] Login successful for:', email, 'via', account?.provider);
        return true;
      } catch (error) {
        console.error('[AUTH-SSO] Error during SSO sign-in:', error);
        return "/login?error=SSOError";
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "credentials") {
          // Credentials flow: user object from authorize() has all DB fields
          token.id = user.id;
          token.role = user.role;
          token.department = user.department;
          token.departmentId = user.departmentId;
          token.departmentName = user.departmentName;
          token.customerAccountId = user.customerAccountId;
          token.customerAccountCode = user.customerAccountCode;
          token.customerAccountName = user.customerAccountName;
          token.auditHeadId = user.auditHeadId;
          token.isGrcAdded = user.isGrcAdded;
          token.isTprmAdded = user.isTprmAdded;
          token.isInternalAuditEnabled = user.isInternalAuditEnabled;
          token.isTechnicalEvidenceEnabled = user.isTechnicalEvidenceEnabled;
          token.isQpostComplianceEnabled = user.isQpostComplianceEnabled;
          token.subscriptionStatus = user.subscriptionStatus ?? null;
          token.subscriptionType = user.subscriptionType ?? null;
          token.roles = user.roles;
          token.roleModules = user.roleModules ?? [];
        } else {
          // OAuth flow: user object only has OAuth profile data
          // Must query DB to load roles, department, customerAccount, etc.
          const email = user.email;
          if (email) {
            const dbUser = await prisma.user.findFirst({
              where: {
                email: { equals: email, mode: "insensitive" },
                isActive: true,
                isBlocked: false,
              },
              select: userSelect,
            });

            if (dbUser) {
              // Auto-repair TPRM role for OAuth users too — same race fix
              // as the credentials path. The companion extraRoleModules
              // makes sure the freshly-provisioned UserRole's TPRM module
              // is reflected in roleModules on the FIRST login.
              const oauthRoleNames = dbUser.userRoles.map(ur => ur.role.name);
              const oauthTprmSystemRole = dbUser.tprmRole ? TPRM_ROLE_TO_SYSTEM_ROLE[dbUser.tprmRole] : null;
              let oauthExtraRoles: string[] | undefined;
              let oauthExtraRoleModules: Array<"GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE"> | undefined;
              if (oauthTprmSystemRole && !oauthRoleNames.includes(oauthTprmSystemRole)) {
                await ensureTprmUserRole(dbUser.id, dbUser.tprmRole, oauthRoleNames);
                oauthExtraRoles = [oauthTprmSystemRole];
                oauthExtraRoleModules = ["TPRM"];
              }
              const authUser = await buildAuthUser(dbUser, oauthExtraRoles, oauthExtraRoleModules);
              token.id = authUser.id; // Critical: override OAuth provider ID with DB user ID
              token.role = authUser.role;
              token.department = authUser.department;
              token.departmentId = authUser.departmentId;
              token.departmentName = authUser.departmentName;
              token.customerAccountId = authUser.customerAccountId;
              token.customerAccountCode = authUser.customerAccountCode;
              token.customerAccountName = authUser.customerAccountName;
              token.auditHeadId = authUser.auditHeadId;
              token.isGrcAdded = authUser.isGrcAdded;
              token.isTprmAdded = authUser.isTprmAdded;
              token.isInternalAuditEnabled = authUser.isInternalAuditEnabled;
              token.isTechnicalEvidenceEnabled = authUser.isTechnicalEvidenceEnabled;
              token.isQpostComplianceEnabled = authUser.isQpostComplianceEnabled;
              token.subscriptionStatus = authUser.subscriptionStatus ?? null;
              token.subscriptionType = authUser.subscriptionType ?? null;
              token.roles = authUser.roles;
              token.roleModules = authUser.roleModules ?? [];
            }
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string); // Use stored ID or fallback to sub
        session.user.role = token.role as string;
        session.user.department = token.department as string;
        session.user.departmentId = token.departmentId as string | null;
        session.user.departmentName = token.departmentName as string | null;
        // Multi-tenant: Include customer account in session
        session.user.customerAccountId = token.customerAccountId as string | null;
        session.user.customerAccountCode = token.customerAccountCode as string | null;
        session.user.customerAccountName = token.customerAccountName as string | null;
        // Audit Head isolation: Include auditHeadId in session
        session.user.auditHeadId = token.auditHeadId as string | null;
        session.user.isGrcAdded = (token.isGrcAdded as boolean) ?? false;
        session.user.isTprmAdded = (token.isTprmAdded as boolean) ?? false;
        session.user.isInternalAuditEnabled = (token.isInternalAuditEnabled as boolean) ?? session.user.isGrcAdded;
        session.user.isTechnicalEvidenceEnabled = (token.isTechnicalEvidenceEnabled as boolean) ?? false;
        session.user.isQpostComplianceEnabled = (token.isQpostComplianceEnabled as boolean) ?? false;
        session.user.subscriptionStatus = (token.subscriptionStatus as SubscriptionStatus | null) ?? null;
        session.user.subscriptionType = (token.subscriptionType as SubscriptionType | null) ?? null;
        session.user.roles = (token.roles as string[]) || [];
        session.user.roleModules = (token.roleModules as ("GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE")[]) || [];

        // Expand permissions from roles here (session callback runs server-side)
        // Filter permissions based on module flags
        session.user.permissions = expandRolePermissions(
          session.user.roles,
          {
            isGrcAdded: session.user.isGrcAdded,
            isTprmAdded: session.user.isTprmAdded,
            isInternalAuditEnabled: session.user.isInternalAuditEnabled,
            isTechnicalEvidenceEnabled: session.user.isTechnicalEvidenceEnabled,
            isQpostComplianceEnabled: session.user.isQpostComplianceEnabled,
          }
        );
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    // Rolling 30-minute inactivity expiry: cookie lives 30 min; on any request
    // older than 5 min, the JWT is re-issued, sliding the window forward.
    // Inactive ≥30 min → token expires and the user is forced back to /login.
    maxAge: 30 * 60,
    updateAge: 5 * 60,
  },
  jwt: {
    maxAge: 30 * 60,
  },
});
