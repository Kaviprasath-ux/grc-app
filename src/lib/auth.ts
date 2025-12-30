import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Mock users data
const users = [
  {
    id: "1",
    username: "bts",
    password: "1",
    name: "BTS Admin",
    email: "admin@baarez.com",
    role: "Administrator",
    department: "IT Operations",
  },
  {
    id: "2",
    username: "admin",
    password: "admin123",
    name: "System Admin",
    email: "sysadmin@baarez.com",
    role: "GRC Admin",
    department: "Compliance",
  },
  {
    id: "3",
    username: "auditor",
    password: "auditor123",
    name: "John Auditor",
    email: "auditor@baarez.com",
    role: "Auditor",
    department: "Internal Audit",
  },
];

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

        const user = users.find(
          (u) =>
            u.username === credentials.username &&
            u.password === credentials.password
        );

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.department = token.department as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
