import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET all probabilities
// Note: AuditProbability model doesn't have customerAccountId field yet - tenant filtering disabled
export const GET = withAuth(
  async () => {
    try {
      const probabilities = await prisma.auditProbability.findMany({
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
// Note: AuditProbability model doesn't have customerAccountId field yet - tenant assignment disabled
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
      const existing = await prisma.auditProbability.findFirst({
        where: { label },
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
