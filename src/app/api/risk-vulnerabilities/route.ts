import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all risk vulnerabilities - with tenant filtering
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      const vulnerabilities = await prisma.riskVulnerability.findMany({
        where: tenantFilter,
        include: {
          category: true,
          _count: {
            select: { risks: true },
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(vulnerabilities);
    } catch (error) {
      console.error("Error fetching risk vulnerabilities:", error);
      return NextResponse.json(
        { error: "Failed to fetch risk vulnerabilities" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create a new risk vulnerability - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name, description } = body;

      if (!name) {
        return NextResponse.json(
          { error: "Vulnerability name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant
      const existing = await prisma.riskVulnerability.findFirst({
        where: {
          customerAccountId,
          name,
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Vulnerability with this name already exists" },
          { status: 400 }
        );
      }

      const vulnerability = await prisma.riskVulnerability.create({
        data: {
          customerAccountId,
          name,
          description,
        },
      });

      return NextResponse.json(vulnerability, { status: 201 });
    } catch (error) {
      console.error("Error creating risk vulnerability:", error);
      return NextResponse.json(
        { error: "Failed to create risk vulnerability" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
