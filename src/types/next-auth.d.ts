import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";
import { UserPermission } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string; // Legacy - keeping for backwards compatibility
      department: string; // Legacy - keeping for backwards compatibility
      departmentId: string | null;
      departmentName: string | null;
      roles: string[];
      permissions: UserPermission[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    department: string;
    departmentId: string | null;
    departmentName: string | null;
    roles: string[];
    permissions: UserPermission[];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: string;
    department: string;
    departmentId: string | null;
    departmentName: string | null;
    roles: string[];
    permissions: UserPermission[];
  }
}
