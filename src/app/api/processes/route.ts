import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET all processes - filtered by tenant
export async function GET() {
  try {
    const session = await auth();
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    // Build tenant filter (strict isolation)
    const tenantFilter = !isGRCAdmin && customerAccountId
      ? { customerAccountId }
      : {};

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
}

// POST create new process - with tenant assignment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const customerAccountId = session?.user?.customerAccountId;

    const body = await request.json();
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
      externalDependency,
      location,
      kpiMeasurementRequired,
      piiCapture,
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

    if (!customerAccountId) {
      return NextResponse.json(
        { error: "User must belong to a customer account" },
        { status: 403 }
      );
    }

    // Generate process code if not provided
    let finalProcessCode = processCode;
    if (!finalProcessCode) {
      const lastProcess = await prisma.process.findFirst({
        orderBy: { processCode: "desc" },
      });
      const lastNum = lastProcess
        ? parseInt(lastProcess.processCode.replace("PRO", "")) || 0
        : 0;
      finalProcessCode = `PRO${lastNum + 1}`;
    }

    // Check if process code already exists within the same tenant
    const existingProcess = await prisma.process.findFirst({
      where: {
        processCode: finalProcessCode,
        ...(customerAccountId ? { customerAccountId } : {}),
      },
    });

    if (existingProcess) {
      console.log(`Process code ${finalProcessCode} already exists`);
      return NextResponse.json(
        { error: `Process code ${finalProcessCode} already exists` },
        { status: 400 }
      );
    }

    const processData = {
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
        externalDependency: externalDependency || false,
        location,
        kpiMeasurementRequired: kpiMeasurementRequired || false,
        piiCapture: piiCapture || false,
        operationalComplexity,
        lastAuditDate: lastAuditDate ? new Date(lastAuditDate) : null,
        responsibleId: responsibleId || null,
        accountableId: accountableId || null,
        consultedId: consultedId || null,
        informedId: informedId || null,
      };

    if (customerAccountId) {
      (processData as Record<string, unknown>).customerAccountId = customerAccountId;
    }

    const process = await prisma.process.create({
      data: processData as Parameters<typeof prisma.process.create>[0]['data'],
      include: {
        department: true,
        owner: true,
      },
    });

    return NextResponse.json(process, { status: 201 });
  } catch (error: any) {
    console.error("Error creating process:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create process" },
      { status: 500 }
    );
  }
}
