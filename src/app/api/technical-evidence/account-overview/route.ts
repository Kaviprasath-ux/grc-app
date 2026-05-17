import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

/**
 * GET /api/technical-evidence/account-overview
 *
 * Superadmin (GRCAdministrator) tenant list filtered to customers with
 * isTechnicalEvidenceEnabled = true. Mirrors the IA account-overview pattern.
 *
 * Returns: CustomerAccount + primary CustomerAdministrator + counts of
 * integration credentials + technical evidence collections.
 */
export const GET = withAuth(
  async (req) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      // Find accounts with TE enabled — raw query for the same reason as IA
      // (Prisma client field may lag the schema until `prisma generate` runs).
      let teAccountIds: string[] = [];
      try {
        const teAccounts = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "CustomerAccount" WHERE "isTechnicalEvidenceEnabled" = true`
        );
        teAccountIds = teAccounts.map((a) => a.id);
      } catch {
        // Column missing → empty result
      }

      if (teAccountIds.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        });
      }

      const where: Record<string, unknown> = {
        id: { in: teAccountIds },
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
              select: {
                integrationCredentials: true,
                technicalEvidenceCollections: true,
              },
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
        credentialCount: a._count.integrationCredentials,
        collectionCount: a._count.technicalEvidenceCollections,
      }));

      return NextResponse.json({
        data,
        pagination: { total, limit, offset, hasMore: offset + data.length < total },
      });
    } catch (e) {
      console.error("[/api/technical-evidence/account-overview] failed:", e);
      return NextResponse.json({ error: "Failed to load account overview" }, { status: 500 });
    }
  },
  { resource: "technical-evidence.account-overview", action: "view" }
);
