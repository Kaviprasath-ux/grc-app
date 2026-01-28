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
      // Multi-tenant: Customer account information
      customerAccountId: string | null;
      customerAccountCode: string | null;
      customerAccountName: string | null;
      // Audit Head isolation: Links user to their managing Audit Head
      auditHeadId: string | null;
      roles: string[];
      permissions: UserPermission[];
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    department: string;
    departmentId: string | null;
    departmentName: string | null;
    // Multi-tenant: Customer account information
    customerAccountId: string | null;
    customerAccountCode: string | null;
    customerAccountName: string | null;
    // Audit Head isolation: Links user to their managing Audit Head
    auditHeadId: string | null;
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
    // Multi-tenant: Customer account information
    customerAccountId: string | null;
    customerAccountCode: string | null;
    customerAccountName: string | null;
    // Audit Head isolation: Links user to their managing Audit Head
    auditHeadId: string | null;
    roles: string[];
    permissions: UserPermission[];
  }
}
