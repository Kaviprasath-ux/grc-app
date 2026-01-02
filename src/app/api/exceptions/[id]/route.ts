import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single exception
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const exception = await prisma.exception.findUnique({
      where: { id },
      include: {
        department: true,
        control: {
          include: {
            domain: true,
            framework: true,
          },
        },
        policy: true,
        risk: {
          include: {
            category: true,
          },
        },
        requester: true,
        approver: true,
        comments: {
          orderBy: { createdAt: "desc" },
        },
        policyExceptions: {
          include: {
            policy: true,
          },
        },
      },
    });

    if (!exception) {
      return NextResponse.json(
        { error: "Exception not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(exception);
  } catch (error) {
    console.error("Error fetching exception:", error);
    return NextResponse.json(
      { error: "Failed to fetch exception" },
      { status: 500 }
    );
  }
}

// PUT update exception
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
      category,
      departmentId,
      controlId,
      policyId,
      riskId,
      requesterId,
      approverId,
      approvedBy,
      approvedDate,
      status,
      endDate,
    } = body;

    // Build update data based on category
    const updateData: Record<string, unknown> = {
      name,
      description,
      departmentId: departmentId || null,
      requesterId: requesterId || null,
      approverId: approverId || null,
      status,
      endDate: endDate ? new Date(endDate) : null,
    };

    // Only update category if provided
    if (category) {
      updateData.category = category;
      // Clear old references and set new one based on category
      updateData.controlId = null;
      updateData.policyId = null;
      updateData.riskId = null;

      if (category === "Control" && controlId) {
        updateData.controlId = controlId;
      } else if (category === "Policy" && policyId) {
        updateData.policyId = policyId;
      } else if (category === "Risk" && riskId) {
        updateData.riskId = riskId;
      }
    }

    // Set approval info if status is being changed to Approved
    if (status === "Approved" && approvedBy) {
      updateData.approvedBy = approvedBy;
      updateData.approvedDate = approvedDate ? new Date(approvedDate) : new Date();
    }

    const exception = await prisma.exception.update({
      where: { id },
      data: updateData,
      include: {
        department: true,
        control: true,
        policy: true,
        risk: true,
        requester: true,
        approver: true,
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(exception);
  } catch (error: unknown) {
    console.error("Error updating exception:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Exception not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update exception" },
      { status: 500 }
    );
  }
}

// DELETE exception
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.exception.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Exception deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting exception:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Exception not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete exception" },
      { status: 500 }
    );
  }
}
