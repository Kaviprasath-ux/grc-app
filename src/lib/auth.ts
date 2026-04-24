import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { expandRolePermissions, type UserPermission } from "@/lib/permissions";

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
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  } catch {
    // Non-fatal — log and continue
    console.error(`[AUTH] Failed to auto-assign ${systemRoleName} role for user ${userId}`);
  }
}

// Helper to build the user object returned to NextAuth from a DB user
function buildAuthUser(dbUser: {
  id: string;
  fullName: string;
  email: string;
  tprmRole?: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  customerAccountId: string | null;
  customerAccount: { id: string; code: string; name: string; isGrcAdded: boolean; isTprmAdded: boolean; isQpostComplianceEnabled: boolean } | null;
  auditHeadId: string | null;
  userRoles: { role: { id: string; name: string } }[];
}, extraRoles?: string[]) {
  const roleNames = dbUser.userRoles.map(ur => ur.role.name);
  if (extraRoles) roleNames.push(...extraRoles.filter(r => !roleNames.includes(r)));
  const effectiveRoles = roleNames.length > 0 ? roleNames : ['Contributor'];
  const primaryRole = effectiveRoles[0] || 'Contributor';

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
    // Legacy accounts (created before module flags) have both as false — default isGrcAdded=true
    isGrcAdded: (dbUser.customerAccount?.isGrcAdded === false && dbUser.customerAccount?.isTprmAdded === false)
      ? true
      : (dbUser.customerAccount?.isGrcAdded ?? true),
    isTprmAdded: dbUser.customerAccount?.isTprmAdded ?? false,
    isQpostComplianceEnabled: dbUser.customerAccount?.isQpostComplianceEnabled ?? false,
    roles: effectiveRoles,
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

        // Auto-repair: ensure TPRM users have their system role assigned
        const existingRoleNames = user.userRoles.map(ur => ur.role.name);
        const tprmSystemRole = user.tprmRole ? TPRM_ROLE_TO_SYSTEM_ROLE[user.tprmRole] : null;
        let extraRoles: string[] | undefined;
        if (tprmSystemRole && !existingRoleNames.includes(tprmSystemRole)) {
          await ensureTprmUserRole(user.id, user.tprmRole, existingRoleNames);
          extraRoles = [tprmSystemRole];
        }

        return buildAuthUser(user, extraRoles);
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
          token.isQpostComplianceEnabled = user.isQpostComplianceEnabled;
          token.roles = user.roles;
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
              // Auto-repair TPRM role for OAuth users too
              const oauthRoleNames = dbUser.userRoles.map(ur => ur.role.name);
              const oauthTprmSystemRole = dbUser.tprmRole ? TPRM_ROLE_TO_SYSTEM_ROLE[dbUser.tprmRole] : null;
              let oauthExtraRoles: string[] | undefined;
              if (oauthTprmSystemRole && !oauthRoleNames.includes(oauthTprmSystemRole)) {
                await ensureTprmUserRole(dbUser.id, dbUser.tprmRole, oauthRoleNames);
                oauthExtraRoles = [oauthTprmSystemRole];
              }
              const authUser = buildAuthUser(dbUser, oauthExtraRoles);
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
              token.isQpostComplianceEnabled = authUser.isQpostComplianceEnabled;
              token.roles = authUser.roles;
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
        session.user.isQpostComplianceEnabled = (token.isQpostComplianceEnabled as boolean) ?? false;
        session.user.roles = (token.roles as string[]) || [];

        // Expand permissions from roles here (session callback runs server-side)
        // Filter permissions based on module flags (isGrcAdded / isTprmAdded)
        session.user.permissions = expandRolePermissions(
          session.user.roles,
          { isGrcAdded: session.user.isGrcAdded, isTprmAdded: session.user.isTprmAdded, isQpostComplianceEnabled: session.user.isQpostComplianceEnabled }
        );
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
