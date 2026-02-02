import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { expandRolePermissions } from "@/lib/permissions";

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
        // Find user in database
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { userName: credentials.username as string },
              { email: credentials.username as string },
            ],
            isActive: true,
            isBlocked: false,
          },
          include: {
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
              },
            },
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
          },
        });

        if (!user) {
          console.log('[AUTH] User not found');
          return null;
        }

        console.log('[AUTH] User found:', user.userName, 'isActive:', user.isActive, 'isBlocked:', user.isBlocked);

        // Compare password using bcrypt
        const inputPassword = String(credentials.password);
        const isValidPassword = await bcrypt.compare(inputPassword, user.password);
        if (!isValidPassword) {
          console.log('[AUTH] Password mismatch');
          return null;
        }

        console.log('[AUTH] Login successful for:', user.userName);

        // Extract role names from userRoles
        const roleNames = user.userRoles.map(ur => ur.role.name);

        // If user has no roles assigned, give them a default Contributor role
        const effectiveRoles = roleNames.length > 0 ? roleNames : ['Contributor'];

        // Get primary role for backwards compatibility
        const primaryRole = effectiveRoles[0] || 'Contributor';

        // Note: We only return role names, not expanded permissions
        // Permissions are expanded in the session callback to avoid JWT size issues
        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: primaryRole, // Legacy field
          department: user.department?.name || '', // Legacy field
          departmentId: user.departmentId,
          departmentName: user.department?.name || null,
          // Multi-tenant: Include customer account information
          customerAccountId: user.customerAccountId,
          customerAccountCode: user.customerAccount?.code || null,
          customerAccountName: user.customerAccount?.name || null,
          // Note: User model doesn't have auditHeadId field yet
          roles: effectiveRoles,
          permissions: [], // Placeholder - expanded in session callback
        };
        } catch (error) {
          console.error('[AUTH] Error during authentication:', error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id; // Store the database user ID
        token.role = user.role;
        token.department = user.department;
        token.departmentId = user.departmentId;
        token.departmentName = user.departmentName;
        // Multi-tenant: Store customer account info in JWT
        token.customerAccountId = user.customerAccountId;
        token.customerAccountCode = user.customerAccountCode;
        token.customerAccountName = user.customerAccountName;
        // Note: User model doesn't have auditHeadId field yet
        token.roles = user.roles;
        // Don't store permissions in JWT - they'll be expanded in session callback
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
        // Note: User model doesn't have auditHeadId field yet
        session.user.roles = (token.roles as string[]) || [];

        // Expand permissions from roles here (session callback runs server-side)
        session.user.permissions = expandRolePermissions(session.user.roles);
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
