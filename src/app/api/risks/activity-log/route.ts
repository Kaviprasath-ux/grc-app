import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all risk activity logs with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const riskId = searchParams.get("riskId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (riskId) {
      // Find the risk by riskId (the display ID like RID001)
      const risk = await prisma.risk.findFirst({
        where: { riskId },
        select: { id: true },
      });
      if (risk) {
        where.riskId = risk.id;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.riskActivityLog.findMany({
        where,
        include: {
          risk: {
            select: {
              id: true,
              riskId: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.riskActivityLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      pagination: {
        total,
        limit,
        offset,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// POST create a new activity log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { riskId, activity, description, actor, actorId, metadata } = body;

    if (!riskId || !activity || !actor) {
      return NextResponse.json(
        { error: "riskId, activity, and actor are required" },
        { status: 400 }
      );
    }

    // Find the risk by riskId (the display ID like RID001)
    const risk = await prisma.risk.findFirst({
      where: { riskId },
      select: { id: true },
    });

    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    const log = await prisma.riskActivityLog.create({
      data: {
        riskId: risk.id,
        activity,
        description,
        actor,
        actorId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      include: {
        risk: {
          select: {
            id: true,
            riskId: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating activity log:", error);
    return NextResponse.json(
      { error: "Failed to create activity log" },
      { status: 500 }
    );
  }
}
