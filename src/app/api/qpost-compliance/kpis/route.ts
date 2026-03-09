import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all QPost KPIs with filters - filtered by customer account
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status");
      const departmentId = searchParams.get("departmentId");
      const evidenceId = searchParams.get("evidenceId");
      const search = searchParams.get("search");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const tenantFilter = getTenantFilter(session);
      const where: Record<string, unknown> = {
        ...tenantFilter,
        // Only show KPIs that are linked to Evidence
        evidenceId: { not: null },
      };

      // Department-based filtering for DepartmentContributor and DepartmentReviewer roles
      // These roles should only see KPIs belonging to their department (via evidence's department)
      const isDepartmentRole = session.roles?.some((role: string) =>
        ['DepartmentContributor', 'DepartmentReviewer'].includes(role)
      );
      if (isDepartmentRole && session.departmentId) {
        // Filter by KPI's evidence's department
        where.evidence = { departmentId: session.departmentId };
      } else if (departmentId) {
        where.departmentId = departmentId;
      }

      if (status) where.status = status;
      if (evidenceId) where.evidenceId = evidenceId;
      if (search) {
        where.AND = [
          ...(where.AND as unknown[] || []),
          {
            OR: [
              { code: { contains: search } },
              { objective: { contains: search } },
              { description: { contains: search } },
            ],
          },
        ];
      }

      const [kpis, total] = await Promise.all([
        prisma.qPostKPI.findMany({
          where,
          include: {
            department: true,
            evidence: {
              include: {
                department: true,
              },
            },
            reviews: {
              orderBy: { reviewDate: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.qPostKPI.count({ where }),
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
      console.error("Error fetching QPost KPIs:", error);
      return NextResponse.json(
        { error: "Failed to fetch KPIs" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.kpi", action: "view" }
);

// POST create new QPost KPI - with customer account assignment
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
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

      // Get customer account ID for the new record
      const customerAccountId = getCustomerAccountId(session);

      // Generate code if not provided (auto-generate like UAT system)
      let kpiCode = code;
      if (!kpiCode) {
        const lastKpi = await prisma.qPostKPI.findFirst({
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

      const kpi = await prisma.qPostKPI.create({
        data: {
          customerAccountId,
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
          evidence: {
            include: {
              department: true,
            },
          },
          reviews: true,
        },
      });

      return NextResponse.json(kpi, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating QPost KPI:", error);
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
  },
  { resource: "qpost-compliance.kpi", action: "create" }
);
