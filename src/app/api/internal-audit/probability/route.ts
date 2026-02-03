import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all probabilities
// Multi-tenant: Filter by customerAccountId and auditHeadId
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      const probabilities = await prisma.auditProbability.findMany({
        where: {
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
        orderBy: { value: "asc" },
      });

      return NextResponse.json(probabilities);
    } catch (error) {
      console.error("Error fetching probabilities:", error);
      return NextResponse.json(
        { error: "Failed to fetch probabilities" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create a new probability
// Multi-tenant: Associate with customerAccountId and auditHeadId
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const body = await req.json();
      const { label, value } = body;
      const tenantFilter = getTenantFilter(session);
      const auditHeadId = getAuditHeadId(session);

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within same tenant and audit head
      const existing = await prisma.auditProbability.findFirst({
        where: {
          label,
          ...tenantFilter,
          ...(auditHeadId ? { auditHeadId } : {}),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Probability with this label already exists" },
          { status: 400 }
        );
      }

      const probability = await prisma.auditProbability.create({
        data: {
          label,
          value: value || 0,
          customerAccountId: session.customerAccountId,
          auditHeadId: auditHeadId,
        },
      });

      return NextResponse.json(probability, { status: 201 });
    } catch (error) {
      console.error("Error creating probability:", error);
      return NextResponse.json(
        { error: "Failed to create probability" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
