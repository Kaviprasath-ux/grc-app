import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all KPIs with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const departmentId = searchParams.get("departmentId");
    const evidenceId = searchParams.get("evidenceId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (evidenceId) where.evidenceId = evidenceId;
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { objective: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [kpis, total] = await Promise.all([
      prisma.kPI.findMany({
        where,
        include: {
          department: true,
          evidence: true,
          reviews: {
            orderBy: { reviewDate: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kPI.count({ where }),
    ]);

    return NextResponse.json({
      data: kpis,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching KPIs:", error);
    return NextResponse.json(
      { error: "Failed to fetch KPIs" },
      { status: 500 }
    );
  }
}

// POST create new KPI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      code,
      objective,
      description,
      dataSource,
      calculationFormula,
      expectedScore,
      actualScore,
      reviewDate,
      status,
      departmentId,
      evidenceId,
    } = body;

    // Generate code if not provided (auto-generate like UAT system)
    let kpiCode = code;
    if (!kpiCode) {
      const lastKpi = await prisma.kPI.findFirst({
        orderBy: { createdAt: "desc" },
        select: { code: true },
      });

      // Extract number from last code and increment
      let nextNum = 1;
      if (lastKpi?.code) {
        const match = lastKpi.code.match(/(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1]) + 1;
        }
      }
      kpiCode = `KPI-${String(nextNum).padStart(3, "0")}`;
    }

    const kpi = await prisma.kPI.create({
      data: {
        code: kpiCode,
        objective,
        description,
        dataSource,
        calculationFormula,
        expectedScore: expectedScore ? parseFloat(expectedScore) : null,
        actualScore: actualScore ? parseFloat(actualScore) : null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        status: status || "Scheduled",
        departmentId: departmentId || null,
        evidenceId: evidenceId || null,
      },
      include: {
        department: true,
        evidence: true,
        reviews: true,
      },
    });

    return NextResponse.json(kpi, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating KPI:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "KPI with this code already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create KPI" },
      { status: 500 }
    );
  }
}
