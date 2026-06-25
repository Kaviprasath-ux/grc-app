import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { getPermissionScope } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const SORTABLE = new Set(["createdAt", "userName", "userRole", "action", "module"]);

// GET - read the audit trail (scoped, filtered, paginated, sortable).
// Standard users (scope 'own') see only their own activity; Customer Admin /
// senior audit roles (scope 'all') see all activity within their organization.
export const GET = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const scope = getPermissionScope(session.permissions, "audit.audit-trail", "view");
      const seeAll = scope === "all";

      const { searchParams } = new URL(req.url);

      // Facets mode: return distinct filter values (for admin filter dropdowns).
      if (searchParams.get("facets") === "1") {
        if (!seeAll) {
          return NextResponse.json({ modules: [], roles: [], actions: [], users: [] });
        }
        const baseWhere: Prisma.AuditTrailWhereInput = customerAccountId ? { customerAccountId } : {};
        const [modules, roles, actions, users] = await Promise.all([
          prisma.auditTrail.findMany({ where: baseWhere, distinct: ["module"], select: { module: true }, orderBy: { module: "asc" } }),
          prisma.auditTrail.findMany({ where: baseWhere, distinct: ["userRole"], select: { userRole: true } }),
          prisma.auditTrail.findMany({ where: baseWhere, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
          prisma.auditTrail.findMany({ where: baseWhere, distinct: ["userName"], select: { userName: true }, orderBy: { userName: "asc" } }),
        ]);
        return NextResponse.json({
          modules: modules.map((m) => m.module).filter(Boolean),
          roles: [...new Set(roles.map((r) => r.userRole).filter(Boolean))],
          actions: actions.map((a) => a.action).filter(Boolean),
          users: users.map((u) => u.userName).filter(Boolean),
        });
      }

      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get("pageSize") || "25", 10) || 25));
      const sortByParam = searchParams.get("sortBy") || "createdAt";
      const sortBy = SORTABLE.has(sortByParam) ? sortByParam : "createdAt";
      const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

      const where: Prisma.AuditTrailWhereInput = {};
      if (customerAccountId) where.customerAccountId = customerAccountId;
      // Standard users are restricted to their own activity.
      if (!seeAll) where.userId = session.id;

      // Admin filters (ignored for own-scope users, who can't filter by user).
      if (seeAll) {
        const userName = searchParams.get("userName")?.trim();
        const userRole = searchParams.get("userRole")?.trim();
        if (userName) where.userName = { contains: userName, mode: "insensitive" };
        if (userRole) where.userRole = { contains: userRole, mode: "insensitive" };
      }
      const action = searchParams.get("action")?.trim();
      const moduleName = searchParams.get("module")?.trim();
      if (action) where.action = action;
      if (moduleName) where.module = moduleName;

      const from = searchParams.get("from");
      const to = searchParams.get("to");
      if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
        if (to) {
          const end = new Date(to);
          end.setHours(23, 59, 59, 999);
          (where.createdAt as Prisma.DateTimeFilter).lte = end;
        }
      }

      // Free-text search across user / module / action / record id.
      const q = searchParams.get("q")?.trim();
      if (q) {
        where.OR = [
          { userName: { contains: q, mode: "insensitive" } },
          { module: { contains: q, mode: "insensitive" } },
          { action: { contains: q, mode: "insensitive" } },
          { recordId: { contains: q, mode: "insensitive" } },
          { userRole: { contains: q, mode: "insensitive" } },
        ];
      }

      const [total, rows] = await Promise.all([
        prisma.auditTrail.count({ where }),
        prisma.auditTrail.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      return NextResponse.json({
        rows,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        scope: seeAll ? "all" : "own",
      });
    } catch (error) {
      console.error("Error reading audit trail:", error);
      return NextResponse.json({ error: "Failed to read audit trail" }, { status: 500 });
    }
  },
  { resource: "audit.audit-trail", action: "view" }
);
