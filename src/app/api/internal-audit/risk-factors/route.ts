import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET all risk factors
// Note: AuditRiskFactor model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      const factors = await prisma.auditRiskFactor.findMany({
        orderBy: { label: "asc" },
      });

      return NextResponse.json(factors);
    } catch (error) {
      console.error("Error fetching risk factors:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk factors" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create a new risk factor
// Note: AuditRiskFactor model doesn't have customerAccountId field yet - tenant assignment disabled
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { label } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const existing = await prisma.auditRiskFactor.findFirst({
        where: { label },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Risk factor with this label already exists" },
          { status: 400 }
        );
      }

      const factor = await prisma.auditRiskFactor.create({
        data: { label },
      });

      return NextResponse.json(factor, { status: 201 });
    } catch (error) {
      console.error("Error creating risk factor:", error);
      return NextResponse.json(
        { error: "Failed to create risk factor" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
