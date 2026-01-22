import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all controls linked to a matrix entry
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Verify entry exists and belongs to this tenant
      const entry = await prisma.riskControlMatrixEntry.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!entry) {
        return NextResponse.json(
          { error: "Risk control matrix entry not found" },
          { status: 404 }
        );
      }

      const linkedControls = await prisma.riskControlMatrixControl.findMany({
        where: {
          riskControlMatrixEntryId: id,
        },
        include: {
          control: {
            select: {
              id: true,
              controlCode: true,
              name: true,
              description: true,
              status: true,
            },
          },
        },
      });

      return NextResponse.json({
        data: linkedControls.map((lc) => lc.control),
      });
    } catch (error) {
      console.error("Error fetching linked controls:", error);
      return NextResponse.json(
        { error: "Failed to fetch linked controls" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "view" }
);

// POST link a control to a matrix entry
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { controlId } = body;

      if (!controlId) {
        return NextResponse.json(
          { error: "controlId is required" },
          { status: 400 }
        );
      }

      // Verify entry exists and belongs to this tenant
      const entry = await prisma.riskControlMatrixEntry.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!entry) {
        return NextResponse.json(
          { error: "Risk control matrix entry not found" },
          { status: 404 }
        );
      }

      // Verify control exists and belongs to this tenant
      const control = await prisma.control.findFirst({
        where: {
          id: controlId,
          customerAccountId,
        },
      });

      if (!control) {
        return NextResponse.json(
          { error: "Control not found" },
          { status: 404 }
        );
      }

      // Check if already linked
      const existingLink = await prisma.riskControlMatrixControl.findFirst({
        where: {
          riskControlMatrixEntryId: id,
          controlId,
        },
      });

      if (existingLink) {
        return NextResponse.json(
          { error: "Control is already linked to this matrix entry" },
          { status: 400 }
        );
      }

      // Create the link
      const link = await prisma.riskControlMatrixControl.create({
        data: {
          riskControlMatrixEntryId: id,
          controlId,
        },
        include: {
          control: {
            select: {
              id: true,
              controlCode: true,
              name: true,
              status: true,
            },
          },
        },
      });

      return NextResponse.json(link, { status: 201 });
    } catch (error) {
      console.error("Error linking control:", error);
      return NextResponse.json(
        { error: "Failed to link control" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.risk-matrix", action: "edit" }
);
