import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET single process - with tenant filtering
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Try to include attachments, but fall back if table doesn't exist yet
      let process;
      try {
        process = await prisma.process.findFirst({
          where: { id, ...tenantFilter },
          include: {
            department: true,
            owner: true,
            attachments: {
              orderBy: { uploadedAt: "desc" },
            },
          },
        });
      } catch {
        // Fallback without attachments if table doesn't exist
        process = await prisma.process.findFirst({
          where: { id, ...tenantFilter },
          include: {
            department: true,
            owner: true,
          },
        });
        if (process) {
          (process as Record<string, unknown>).attachments = [];
        }
      }

      if (!process) {
        return NextResponse.json(
          { error: "Process not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(process);
    } catch (error) {
      console.error("Error fetching process:", error);
      return NextResponse.json(
        { error: "Failed to fetch process" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "view" }
);

// PUT update process - with tenant validation
export const PUT = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const {
        name,
        description,
        processType,
        departmentId,
        ownerId,
        status,
        processFrequency,
        natureOfImplementation,
        riskRating,
        assetDependency,
        assetId,
        externalDependency,
        externalParty,
        location,
        kpiMeasurementRequired,
        piiCapture,
        recurrence,
        reviewDate,
        operationalComplexity,
        lastAuditDate,
        responsibleId,
        accountableId,
        consultedId,
        informedId,
      } = body;

      // Verify the process belongs to the same customer account
      const existingProcess = await prisma.process.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingProcess) {
        return NextResponse.json({ error: "Process not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingProcess.customerAccountId)) {
        return forbidden("Access denied to this process");
      }

      const process = await prisma.process.update({
        where: { id },
        data: {
          name,
          description,
          processType,
          departmentId: departmentId || null,
          ownerId: ownerId || null,
          status,
          processFrequency,
          natureOfImplementation,
          riskRating,
          assetDependency,
          assetId: assetId || null,
          externalDependency,
          externalParty: externalParty || null,
          location,
          kpiMeasurementRequired,
          piiCapture,
          recurrence: recurrence || null,
          reviewDate: reviewDate ? new Date(reviewDate) : null,
          operationalComplexity,
          lastAuditDate: lastAuditDate ? new Date(lastAuditDate) : null,
          responsibleId: responsibleId || null,
          accountableId: accountableId || null,
          consultedId: consultedId || null,
          informedId: informedId || null,
        },
        include: {
          department: true,
          owner: true,
        },
      });

      return NextResponse.json(process);
    } catch (error) {
      console.error("Error updating process:", error);
      return NextResponse.json(
        { error: "Failed to update process" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "edit" }
);

// DELETE process - with tenant validation
export const DELETE = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      // Verify the process belongs to the same customer account
      const existingProcess = await prisma.process.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!existingProcess) {
        return NextResponse.json({ error: "Process not found" }, { status: 404 });
      }

      if (!validateTenantAccess(session, existingProcess.customerAccountId)) {
        return forbidden("Access denied to this process");
      }

      await prisma.process.delete({
        where: { id },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting process:", error);
      return NextResponse.json(
        { error: "Failed to delete process" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "delete" }
);
