import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";
import { UserPermission } from "@/lib/permissions";
import type { SubscriptionStatus, SubscriptionType } from "@prisma/client";

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
      // Audit Head isolation: auditHeadId for audit team members
      auditHeadId: string | null;
      // Module flags from CustomerAccount
      isGrcAdded: boolean;
      isTprmAdded: boolean;
      isInternalAuditEnabled: boolean;
      isTechnicalEvidenceEnabled: boolean;
      isQpostComplianceEnabled: boolean;
      // Subscription snapshot — populated when SUBSCRIPTION_GATING_ENABLED=true.
      // Used by middleware to gate routes; null when gating disabled or no subscription.
      subscriptionStatus: SubscriptionStatus | null;
      subscriptionType: SubscriptionType | null;
      roles: string[];
      // Phase 5b.1: distinct module codes the user holds at least one role in.
      // Excludes null (system roles). Used by ModuleContext to compute the
      // workspace picker's available cards (subscription ∩ has-role).
      roleModules: ("GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE")[];
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
    // Audit Head isolation: auditHeadId for audit team members
    auditHeadId: string | null;
    // Module flags from CustomerAccount
    isGrcAdded: boolean;
    isTprmAdded: boolean;
    isInternalAuditEnabled: boolean;
    isTechnicalEvidenceEnabled: boolean;
    isQpostComplianceEnabled: boolean;
    subscriptionStatus: SubscriptionStatus | null;
    subscriptionType: SubscriptionType | null;
    roles: string[];
    roleModules: ("GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE")[];
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
    // Audit Head isolation: auditHeadId for audit team members
    auditHeadId: string | null;
    // Module flags from CustomerAccount
    isGrcAdded: boolean;
    isTprmAdded: boolean;
    isInternalAuditEnabled: boolean;
    isTechnicalEvidenceEnabled: boolean;
    isQpostComplianceEnabled: boolean;
    subscriptionStatus: SubscriptionStatus | null;
    subscriptionType: SubscriptionType | null;
    roles: string[];
    roleModules: ("GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE")[];
    permissions: UserPermission[];
  }
}
