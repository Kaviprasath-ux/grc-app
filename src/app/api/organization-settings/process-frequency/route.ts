import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all organization-level process frequencies (auditHeadId = null)
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const frequencies = await prisma.processFrequency.findMany({
        where: { ...tenantFilter, auditHeadId: null },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(frequencies);
    } catch (error) {
      console.error("Error fetching process frequencies:", error);
      return NextResponse.json(
        { error: "Failed to fetch process frequencies" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "view" }
);

// POST create a new organization-level process frequency
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name, description } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant (org-level, no auditHeadId)
      const existing = await prisma.processFrequency.findFirst({
        where: {
          name,
          customerAccountId,
          auditHeadId: null,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Process frequency with this name already exists" },
          { status: 400 }
        );
      }

      const frequency = await prisma.processFrequency.create({
        data: {
          name,
          customerAccountId,
          auditHeadId: null,
        },
      });

      return NextResponse.json(frequency, { status: 201 });
    } catch (error) {
      console.error("Error creating process frequency:", error);
      return NextResponse.json(
        { error: "Failed to create process frequency" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.settings", action: "create" }
);
