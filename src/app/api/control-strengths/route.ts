import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all control strengths - with tenant filtering
// GRC Admins get global access to view all settings across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      const strengths = await prisma.controlStrength.findMany({
        where: tenantFilter,
        orderBy: { score: "asc" },
      });
      return NextResponse.json(strengths);
    } catch (error) {
      console.error("Error fetching control strengths:", error);
      return NextResponse.json(
        { error: "Failed to fetch control strengths" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create control strength - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name, score } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within tenant
      const existing = await prisma.controlStrength.findFirst({
        where: {
          customerAccountId,
          name: name.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Control strength already exists" },
          { status: 409 }
        );
      }

      const strength = await prisma.controlStrength.create({
        data: {
          customerAccountId,
          name: name.trim(),
          score: parseInt(score) || 0,
        },
      });

      return NextResponse.json(strength, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating control strength:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Control strength already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create control strength" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
