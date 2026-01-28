import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId, getAuditHeadFilter, getAuditHeadId } from "@/lib/api-auth";

// GET all probabilities - filtered by audit head
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const auditHeadFilter = getAuditHeadFilter(session);

      const probabilities = await prisma.auditProbability.findMany({
        where: { ...tenantFilter, ...auditHeadFilter },
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

// POST create a new probability - assigned to current audit head
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const auditHeadId = getAuditHeadId(session);
      const body = await req.json();
      const { label, value } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same audit head's settings
      const existing = await prisma.auditProbability.findFirst({
        where: { label, auditHeadId },
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
          customerAccountId,
          auditHeadId,
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
