import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";
import { translateRecord, deleteRecordTranslations } from '@/lib/translation-service';

// GET all risk vulnerabilities - with tenant filtering
// GRC Admins get global access to view all vulnerabilities across tenants
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session, { globalAccess: true });

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

      if (session.customerAccountId) void translateRecord(session.customerAccountId, 'RiskVulnerability', vulnerability.id, { name: vulnerability.name, description: vulnerability.description });

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

// DELETE a risk vulnerability - with tenant filtering
export const DELETE = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get("id");

      if (!id) {
        return NextResponse.json(
          { error: "Vulnerability ID is required" },
          { status: 400 }
        );
      }

      const tenantFilter = getTenantFilter(session, { globalAccess: true });

      // Check if vulnerability exists and belongs to tenant
      const existing = await prisma.riskVulnerability.findFirst({
        where: {
          id,
          ...tenantFilter,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Vulnerability not found" },
          { status: 404 }
        );
      }

      await prisma.riskVulnerability.delete({
        where: { id },
      });
      if (session.customerAccountId) void deleteRecordTranslations(session.customerAccountId, 'RiskVulnerability', id);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting risk vulnerability:", error);
      return NextResponse.json(
        { error: "Failed to delete risk vulnerability" },
        { status: 500 }
      );
    }
  },
  { resource: "risk.settings", action: "delete" }
);
