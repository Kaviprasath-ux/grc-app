import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

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

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskThreat', threat.id, { name: threat.name, description: threat.description });

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

// PUT update a risk threat - with tenant filtering
export const PUT = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });
      const body = await req.json();
      const { id, name, description, categoryId } = body;

      if (!id) {
        return NextResponse.json(
          { error: "Threat ID is required" },
          { status: 400 }
        );
      }

      if (!name?.trim()) {
        return NextResponse.json(
          { error: "Threat name is required" },
          { status: 400 }
        );
      }

      // Check if threat exists and belongs to tenant
      const existing = await prisma.riskThreat.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Threat not found" },
          { status: 404 }
        );
      }

      const threat = await prisma.riskThreat.update({
        where: { id },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          categoryId: categoryId || null,
        },
        include: {
          category: true,
        },
      });

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskThreat', threat.id, { name: threat.name, description: threat.description });

      return NextResponse.json(threat);
    } catch (error) {
      console.error("Error updating risk threat:", error);
      return NextResponse.json(
        { error: "Failed to update risk threat" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "edit" }
);

// DELETE a risk threat - with tenant filtering
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");

      if (!id) {
        return NextResponse.json(
          { error: "Threat ID is required" },
          { status: 400 }
        );
      }

      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      // Check if threat exists and belongs to tenant
      const existing = await prisma.riskThreat.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Threat not found" },
          { status: 404 }
        );
      }

      await prisma.riskThreat.delete({
        where: { id },
      });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'RiskThreat', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting risk threat:", error);
      return NextResponse.json(
        { error: "Failed to delete risk threat" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
