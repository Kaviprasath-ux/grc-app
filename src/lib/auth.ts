import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { expandRolePermissions } from "@/lib/permissions";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

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
          return null;
        }

        // Simple password check (in production, use bcrypt)
        if (user.password !== credentials.password) {
          return null;
        }

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
          roles: effectiveRoles,
          permissions: [], // Placeholder - expanded in session callback
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.department = user.department;
        token.departmentId = user.departmentId;
        token.departmentName = user.departmentName;
        token.roles = user.roles;
        // Don't store permissions in JWT - they'll be expanded in session callback
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.department = token.department as string;
        session.user.departmentId = token.departmentId as string | null;
        session.user.departmentName = token.departmentName as string | null;
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
