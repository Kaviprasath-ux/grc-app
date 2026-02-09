import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all risk threats - with tenant filtering
// GRC Admins get global access to view all threats across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      const threats = await prisma.riskThreat.findMany({
        where: tenantFilter,
        include: {
          category: true,
          _count: {
            select: { risks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(threats);
    } catch (error) {
      console.error("Error fetching risk threats:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk threats" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create a new risk threat - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name, description } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Threat name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant
      const existing = await prisma.riskThreat.findFirst({
        where: {
          customerAccountId,
          name,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Threat with this name already exists" },
          { status: 400 }
        );
      }

      const threat = await prisma.riskThreat.create({
        data: {
          customerAccountId,
          name,
          description,
        },
      });

      return NextResponse.json(threat, { status: 201 });
    } catch (error) {
      console.error("Error creating risk threat:", error);
      return NextResponse.json(
        { error: "Failed to create risk threat" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
