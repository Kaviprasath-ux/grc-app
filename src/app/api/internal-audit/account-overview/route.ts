import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

/**
 * GET /api/internal-audit/account-overview
 *
 * Superadmin (GRCAdministrator) tenant list filtered to customers with
 * isInternalAuditEnabled = true. Mirrors /api/tprm/account-overview's
 * "customers" tab — kept intentionally simple (single tab, no vendors/etc).
 *
 * Returns: list of CustomerAccounts with their primary CustomerAdministrator
 * user, active flag, and audit-engagement count for the IA workspace.
 */
export const GET = withAuth(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      // Find accounts with IA enabled. Use raw query because the Prisma client
      // types may not yet expose isInternalAuditEnabled in all environments
      // until `prisma generate` runs against the post-Phase-11 schema.
      let iaAccountIds: string[] = [];
      try {
        const iaAccounts = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "CustomerAccount" WHERE "isInternalAuditEnabled" = true`
        );
        iaAccountIds = iaAccounts.map((a) => a.id);
      } catch {
        // Column missing (extremely unlikely) → empty result
      }

      if (iaAccountIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        });
      }

      const where: Record<string, unknown> = {
        id: { in: iaAccountIds },
        users: {
          some: {
            userRoles: {
              some: { role: { name: "CustomerAdministrator" } },
            },
          },
        },
      };
      if (search) {
        where.AND = [
          {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
      }

      const [accounts, total] = await Promise.all([
        prisma.customerAccount.findMany({
          where,
          include: {
            users: {
              where: {
                userRoles: {
                  some: { role: { name: "CustomerAdministrator" } },
                },
              },
              select: { id: true, fullName: true, email: true },
              take: 1,
            },
            _count: {
              select: { auditEngagements: true, internalAuditFindings: true },
            },
          },
          orderBy: { name: "asc" },
          take: limit,
          skip: offset,
        }),
        prisma.customerAccount.count({ where }),
      ]);

      const data = accounts.map((a) => ({
        id: a.id,
        customerCode: a.code,
        companyName: a.name,
        userId: a.users[0]?.id || null,
        fullName: a.users[0]?.fullName || "-",
        email: a.users[0]?.email || "-",
        active: a.isActive ? "Yes" : "No",
        engagementCount: a._count.auditEngagements,
        findingCount: a._count.internalAuditFindings,
      }));

      return NextResponse.json({
        data,
        pagination: { total, limit, offset, hasMore: offset + data.length < total },
      });
    } catch (e) {
      console.error("[/api/internal-audit/account-overview] failed:", e);
      return NextResponse.json({ error: "Failed to load account overview" }, { status: 500 });
    }
  },
  { resource: "audit.account-overview", action: "view" }
);
