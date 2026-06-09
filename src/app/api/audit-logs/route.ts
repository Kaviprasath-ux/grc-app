import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";

export const GET = withAuth(
  async (req, _context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search") || "";
      const limit = parseInt(searchParams.get("limit") || "20");
      const offset = parseInt(searchParams.get("offset") || "0");
      const customerAccountId = getCustomerAccountId(session);

      const tenantClause = { customerAccountId };
      const searchClause = search
        ? {
            OR: [
              { entityType: { contains: search, mode: "insensitive" as const } },
              { userName: { contains: search, mode: "insensitive" as const } },
              { entityId: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};

      const where = { ...tenantClause, ...searchClause };

      const [auditLogs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return NextResponse.json({
        data: auditLogs,
        total,
        limit,
        offset,
        hasMore: offset + auditLogs.length < total,
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return NextResponse.json(
        { error: "Failed to fetch audit logs" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "view" }
);

export const POST = withAuth(
  async (req, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { changeType, entityType, entityId, userName, changes } = body;

      if (!changeType || !entityType || !entityId) {
        return NextResponse.json(
          { error: "changeType, entityType, and entityId are required" },
          { status: 400 }
        );
      }

      const log = await prisma.auditLog.create({
        data: {
          customerAccountId,
          changeType,
          entityType,
          entityId,
          userId: session.id,
          userName: userName || session.name,
          changes: changes || undefined,
        },
      });

      return NextResponse.json(log, { status: 201 });
    } catch (error) {
      console.error("Error creating audit log:", error);
      return NextResponse.json(
        { error: "Failed to create audit log" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.framework", action: "edit" }
);
