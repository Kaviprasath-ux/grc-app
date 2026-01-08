import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single process
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const process = await prisma.process.findUnique({
      where: { id },
      include: {
        department: true,
        owner: true,
      },
    });

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
}

// PUT update process
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
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
        externalDependency,
        location,
        kpiMeasurementRequired,
        piiCapture,
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
}

// DELETE process
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
}
