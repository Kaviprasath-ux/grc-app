import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all processes
export async function GET() {
  try {
    const processes = await prisma.process.findMany({
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

// POST create new process
export async function POST(request: NextRequest) {
  try {
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

    // Check if process code already exists
    const existingProcess = await prisma.process.findUnique({
      where: { processCode: finalProcessCode },
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
      },
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
