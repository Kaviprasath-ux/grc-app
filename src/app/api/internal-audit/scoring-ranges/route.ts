import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET all scoring ranges
// Note: AuditScoringRange model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const calculationType = searchParams.get("calculationType");

      const where: Record<string, unknown> = {};
      if (calculationType) {
        where.calculationType = calculationType;
      }

      const ranges = await prisma.auditScoringRange.findMany({
        where,
        orderBy: { lowValue: "asc" },
      });

      return NextResponse.json(ranges);
    } catch (error) {
      console.error("Error fetching scoring ranges:", error);
      return NextResponse.json(
        { error: "Failed to fetch scoring ranges" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "edit" }
);

// POST create a new scoring range
// Note: AuditScoringRange model doesn't have customerAccountId field yet - tenant assignment disabled
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { label, lowValue, highValue, calculationType } = body;

      if (!label) {
        return NextResponse.json(
          { error: "Label is required" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const existing = await prisma.auditScoringRange.findFirst({
        where: {
          label,
          calculationType: calculationType || "High of all",
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Scoring range with this label already exists for this calculation type" },
          { status: 400 }
        );
      }

      const range = await prisma.auditScoringRange.create({
        data: {
          label,
          lowValue: lowValue || 0,
          highValue: highValue || null,
          calculationType: calculationType || "High of all",
        },
      });

      return NextResponse.json(range, { status: 201 });
    } catch (error) {
      console.error("Error creating scoring range:", error);
      return NextResponse.json(
        { error: "Failed to create scoring range" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.settings", action: "create" }
);
