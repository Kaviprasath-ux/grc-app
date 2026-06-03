import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/grc/customer-accounts
 * List all customer accounts (GRCAdministrator only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has GRCAdministrator role
    const userRoles = session.user.roles || [];
    if (!userRoles.includes("GRCAdministrator")) {
      return NextResponse.json({ error: "Forbidden - GRCAdministrator role required" }, { status: 403 });
    }

    // Get all users with any admin role (these represent customer accounts)
    // Includes accounts created from both GRC and TPRM flows
    // Also checks legacy 'role' field for backward compatibility
    const rbacAdminRoles = ["CustomerAdministrator", "TPRMCustomerAdmin", "FactoryAdmin", "TPRMAdmin"];
    // Legacy role field may have "Administrator" instead of "CustomerAdministrator"
    const legacyAdminRoles = [...rbacAdminRoles, "Administrator"];
    const customerAccounts = await prisma.user.findMany({
      where: {
        OR: [
          {
            userRoles: {
              some: {
                role: {
                  name: { in: rbacAdminRoles },
                },
              },
            },
          },
          {
            role: { in: legacyAdminRoles },
            customerCode: { not: null },
          },
        ],
      },
      select: {
        id: true,
        userName: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
        customerCode: true,
        lastLogin: true,
        isBlocked: true,
        isActive: true,
        language: true,
        timezone: true,
        departmentId: true,
        customerAccountId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Fetch customer account flags (isGrcAdded, isTprmAdded) via raw query
    // because the Prisma client may not be regenerated yet with these new fields
    const accountIds = customerAccounts
      .map((u) => u.customerAccountId)
      .filter((id): id is string => !!id);

    let accountFlagsMap = new Map<string, { code: string; isGrcAdded: boolean; isTprmAdded: boolean; isInternalAuditEnabled: boolean; isTechnicalEvidenceEnabled: boolean; isQpostComplianceEnabled: boolean; logoUrl: string | null }>();
    if (accountIds.length > 0) {
      try {
        const flags = await prisma.$queryRawUnsafe<
          Array<{ id: string; code: string; isGrcAdded: boolean; isTprmAdded: boolean; isInternalAuditEnabled: boolean; isTechnicalEvidenceEnabled: boolean; isQpostComplianceEnabled: boolean; logoUrl: string | null }>
        >(
          `SELECT id, code, "isGrcAdded", "isTprmAdded", "isInternalAuditEnabled", "isTechnicalEvidenceEnabled", "isQpostComplianceEnabled", "logoUrl" FROM "CustomerAccount" WHERE id IN (${accountIds.map((_, i) => `$${i + 1}`).join(",")})`,
          ...accountIds
        );
        accountFlagsMap = new Map(flags.map((f) => [f.id, { code: f.code, isGrcAdded: f.isGrcAdded, isTprmAdded: f.isTprmAdded, isInternalAuditEnabled: f.isInternalAuditEnabled, isTechnicalEvidenceEnabled: f.isTechnicalEvidenceEnabled, isQpostComplianceEnabled: f.isQpostComplianceEnabled, logoUrl: f.logoUrl }]));
      } catch {
        // If raw query fails (e.g., columns don't exist yet), default to false
      }
    }

    // This page is the single source of truth for ALL customer accounts across
    // every platform (GRC, TPRM, Internal Audit, Technical Evidence, QPost).
    // Show every onboarded account regardless of which module(s) it has —
    // do NOT filter by isGrcAdded (previously hid TPRM-only / IA-only accounts).
    const formattedAccounts = customerAccounts
      .filter((user) => user.customerAccountId)
      .map((user, index) => {
      const flags = user.customerAccountId ? accountFlagsMap.get(user.customerAccountId) : null;
      return {
        id: user.id,
        customerAccountId: user.customerAccountId || null,
        customerCode: flags?.code || user.customerCode || `GRC_${String(index + 1).padStart(3, "0")}`,
        customerName: user.fullName || `${user.firstName} ${user.lastName}`,
        email: user.email,
        userName: user.userName,
        name: user.userName,
        lastLogin: user.lastLogin?.toLocaleString() || user.updatedAt?.toLocaleDateString() || null,
        blocked: user.isBlocked || false,
        blockedSince: null,
        active: user.isActive !== false,
        logoUrl: flags?.logoUrl || null,
        language: user.language || "en-US",
        timeZone: user.timezone || "Asia/Qatar",
        isTprmAdded: flags?.isTprmAdded || false,
        isGrcAdded: flags?.isGrcAdded || false,
        isInternalAuditEnabled: flags?.isInternalAuditEnabled || false,
        isTechnicalEvidenceEnabled: flags?.isTechnicalEvidenceEnabled || false,
        isQpostComplianceEnabled: flags?.isQpostComplianceEnabled || false,
      };
    });

    return NextResponse.json(formattedAccounts);
  } catch (error) {
    console.error("Error fetching customer accounts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
