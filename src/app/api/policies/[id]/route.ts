import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET single policy with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const policy = await prisma.policy.findUnique({
      where: { id },
      include: {
        department: true,
        assignee: true,
        approver: true,
        attachments: true,
        policyControls: {
          include: {
            control: {
              include: {
                domain: true,
              },
            },
          },
        },
        policyExceptions: {
          include: {
            exception: true,
          },
        },
      },
    });

    if (!policy) {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(policy);
  } catch (error) {
    console.error("Error fetching policy:", error);
    return NextResponse.json(
      { error: "Failed to fetch policy" },
      { status: 500 }
    );
  }
}

// PUT update policy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      version,
      documentType,
      recurrence,
      departmentId,
      assigneeId,
      approverId,
      status,
      effectiveDate,
      reviewDate,
      content,
      aiReviewStatus,
      aiReviewScore,
      aiReviewJustification,
    } = body;

    const policy = await prisma.policy.update({
      where: { id },
      data: {
        name,
        version,
        documentType,
        recurrence,
        departmentId,
        assigneeId,
        approverId,
        status,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        reviewDate: reviewDate ? new Date(reviewDate) : null,
        content,
        aiReviewStatus,
        aiReviewScore,
        aiReviewJustification,
      },
      include: {
        department: true,
        assignee: true,
        approver: true,
        attachments: true,
      },
    });

    return NextResponse.json(policy);
  } catch (error: unknown) {
    console.error("Error updating policy:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update policy" },
      { status: 500 }
    );
  }
}

// DELETE policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.policy.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Policy deleted successfully" });
  } catch (error: unknown) {
    console.error("Error deleting policy:", error);
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json(
        { error: "Policy not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete policy" },
      { status: 500 }
    );
  }
}
