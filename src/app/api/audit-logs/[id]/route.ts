import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET a single audit log with its changes (paginated)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get the audit log
    const auditLog = await prisma.auditLog.findUnique({
      where: { id },
    });

    if (!auditLog) {
      return NextResponse.json(
        { error: "Audit log not found" },
        { status: 404 }
      );
    }

    // Get changes with pagination
    const [changes, totalChanges] = await Promise.all([
      prisma.auditLogChange.findMany({
        where: { auditLogId: id },
        orderBy: { attributeName: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLogChange.count({ where: { auditLogId: id } }),
    ]);

    return NextResponse.json({
      ...auditLog,
      changes,
      pagination: {
        total: totalChanges,
        limit,
        offset,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalChanges / limit),
        hasMore: offset + changes.length < totalChanges,
      },
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    );
  }
}
