import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET all impacts
// Note: AuditImpact model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      const impacts = await prisma.auditImpact.findMany({
        orderBy: { value: "asc" },
      });

      return NextResponse.json(impacts);
    } catch (error) {
      console.error("Error fetching impacts:", error);
      return NextResponse.json(
        { error: "Failed to fetch impacts" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create a new impact
// Note: AuditImpact model doesn't have customerAccountId field yet - tenant assignment disabled
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { label, value } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const existing = await prisma.auditImpact.findFirst({
        where: { label },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Impact with this label already exists" },
          { status: 400 }
        );
      }

      const impact = await prisma.auditImpact.create({
        data: {
          label,
          value: value || 0,
        },
      });

      return NextResponse.json(impact, { status: 201 });
    } catch (error) {
      console.error("Error creating impact:", error);
      return NextResponse.json(
        { error: "Failed to create impact" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
