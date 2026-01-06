import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all audit logs with pagination and search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { entityType: { contains: search } },
            { userName: { contains: search } },
            { referenceNumber: { contains: search } },
          ],
        }
      : {};

    // Get audit logs with count
    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { auditLogChanges: true },
          },
        },
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
}
