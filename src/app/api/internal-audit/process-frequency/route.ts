import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId, resolveAuditHeadIdForCreate } from "@/lib/api-auth";

// GET all process frequencies - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const frequencies = await prisma.processFrequency.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
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
  { resource: "audit.settings", action: "view" }
);

// POST create a new process frequency - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = await resolveAuditHeadIdForCreate(session);
      const body = await req.json();
      const { name } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.processFrequency.findFirst({
        where: {
          name,
          auditHeadId,
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
          auditHeadId,
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
  { resource: "audit.settings", action: "create" }
);
