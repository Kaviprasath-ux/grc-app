import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single KPI with reviews - filtered by customer account
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const kpi = await prisma.kPI.findFirst({
        where: { id, ...tenantFilter },
        include: {
          department: true,
          evidence: {
            include: {
              control: true,
              attachments: true,
            },
          },
          reviews: {
            include: {
              actionPlans: {
                orderBy: { createdAt: "desc" },
              },
            },
            orderBy: { reviewDate: "desc" },
          },
        },
      });

      if (!kpi) {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(kpi);
    } catch (error) {
      console.error("Error fetching KPI:", error);
      return NextResponse.json(
        { error: "Failed to fetch KPI" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.kpis", action: "view" }
);

// PUT update KPI - with tenant validation
export const PUT = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
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

      // First, verify the KPI belongs to the user's customer account
      const existing = await prisma.kPI.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this KPI");
      }

      const kpi = await prisma.kPI.update({
        where: { id },
        data: {
          objective,
          description,
          dataSource,
          calculationFormula,
          expectedScore: expectedScore !== undefined ? parseFloat(expectedScore) : undefined,
          actualScore: actualScore !== undefined ? parseFloat(actualScore) : undefined,
          reviewDate: reviewDate ? new Date(reviewDate) : undefined,
          status,
          departmentId: departmentId || undefined,
          evidenceId: evidenceId || undefined,
        },
        include: {
          department: true,
          evidence: true,
          reviews: {
            orderBy: { reviewDate: "desc" },
          },
        },
      });

      return NextResponse.json(kpi);
    } catch (error: unknown) {
      console.error("Error updating KPI:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update KPI" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.kpis", action: "edit" }
);

// DELETE KPI - with tenant validation
export const DELETE = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // First, verify the KPI belongs to the user's customer account
      const existing = await prisma.kPI.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return forbidden("Access denied to this KPI");
      }

      await prisma.kPI.delete({
        where: { id },
      });

      return NextResponse.json({ message: "KPI deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting KPI:", error);
      if ((error as { code?: string }).code === "P2025") {
        return NextResponse.json(
          { error: "KPI not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to delete KPI" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.kpis", action: "delete" }
);
