import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET all processes
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);
      const processes = await prisma.process.findMany({
        where: tenantFilter,
        include: {
          department: true,
          owner: true,
        },
        orderBy: { processCode: "asc" },
      });
      return NextResponse.json(processes);
    } catch (error) {
      console.error("Error fetching processes:", error);
      return NextResponse.json(
        { error: "Failed to fetch processes" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "view" }
);

// POST create new process
export const POST = withAuth(
  async (req, context, session) => {
    try {
      const body = await req.json();
      const {
        processCode,
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

      if (!name) {
        return NextResponse.json(
          { error: "Process name is required" },
          { status: 400 }
        );
      }

      const customerAccountId = getCustomerAccountId(session);
      const tenantFilter = getTenantFilter(session);

      // Generate process code if not provided
      let finalProcessCode = processCode;
      if (!finalProcessCode) {
        const lastProcess = await prisma.process.findFirst({
          where: tenantFilter,
          orderBy: { processCode: "desc" },
        });
        const lastNum = lastProcess
          ? parseInt(lastProcess.processCode.replace("PRO", "")) || 0
          : 0;
        finalProcessCode = `PRO${lastNum + 1}`;
      }

      // Check if process code already exists for this tenant
      const existingProcess = await prisma.process.findUnique({
        where: {
          customerAccountId_processCode: {
            customerAccountId,
            processCode: finalProcessCode,
          },
        },
      });

      if (existingProcess) {
        console.log(`Process code ${finalProcessCode} already exists`);
        return NextResponse.json(
          { error: `Process code ${finalProcessCode} already exists` },
          { status: 400 }
        );
      }

      const process = await prisma.process.create({
        data: {
          customerAccountId,
          processCode: finalProcessCode,
          name,
          description,
          processType: processType || "Primary",
          departmentId: departmentId || null,
          ownerId: ownerId || null,
          status: status || "Active",
          processFrequency,
          natureOfImplementation,
          riskRating,
          assetDependency: assetDependency || false,
          assetId: assetId || null,
          externalDependency: externalDependency || false,
          externalParty: externalParty || null,
          location,
          kpiMeasurementRequired: kpiMeasurementRequired || false,
          piiCapture: piiCapture || false,
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

      return NextResponse.json(process, { status: 201 });
    } catch (error: unknown) {
      console.error("Error creating process:", error);
      return NextResponse.json(
        { error: (error as Error).message || "Failed to create process" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.process", action: "create" }
);
