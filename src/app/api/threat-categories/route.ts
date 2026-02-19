import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord } from '@/lib/translation-service';

// GET all threat categories - with tenant filtering
// GRC Admins get global access to view all categories across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      const categories = await prisma.threatCategory.findMany({
        where: tenantFilter,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { threats: true },
          },
        },
      });
      return NextResponse.json(categories);
    } catch (error) {
      console.error("Error fetching threat categories:", error);
      return NextResponse.json(
        { error: "Failed to fetch threat categories" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "view" }
);

// POST create threat category - with tenant assignment
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const body = await req.json();
      const { name } = body;

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }

      // Check for duplicate within the same tenant
      const existing = await prisma.threatCategory.findFirst({
        where: {
          customerAccountId,
          name: name.trim(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Category already exists" },
          { status: 409 }
        );
      }

      const category = await prisma.threatCategory.create({
        data: {
          customerAccountId,
          name: name.trim(),
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'ThreatCategory', category.id, { name: category.name });

      return NextResponse.json(category, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating threat category:", error);
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json(
          { error: "Category already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create threat category" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "create" }
);
