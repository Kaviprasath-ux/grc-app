import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET comments for a process BIA
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ processId: string }> }
) {
  try {
    const { processId } = await params;

    const processBIA = await prisma.processBIA.findUnique({
      where: { processId },
      include: {
        biaComments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!processBIA) {
      return NextResponse.json([]);
    }

    return NextResponse.json(processBIA.biaComments);
  } catch (error) {
    console.error("Error fetching BIA comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch BIA comments" },
      { status: 500 }
    );
  }
}

// POST add a new comment to process BIA
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ processId: string }> }
) {
  try {
    const { processId } = await params;
    const body = await request.json();
    const { comment, createdBy, createdByName, action, newStatus } = body;

    if (!comment || !createdBy || !createdByName || !action) {
      return NextResponse.json(
        { error: "Missing required fields: comment, createdBy, createdByName, action" },
        { status: 400 }
      );
    }

    // Get or create the ProcessBIA record
    let processBIA = await prisma.processBIA.findUnique({
      where: { processId },
    });

    if (!processBIA) {
      // Create a new ProcessBIA record if one doesn't exist
      processBIA = await prisma.processBIA.create({
        data: {
          processId,
          status: "Open",
        },
      });
    }

    // Create the comment
    const newComment = await prisma.processBIAComment.create({
      data: {
        processBIAId: processBIA.id,
        comment,
        createdBy,
        createdByName,
        action,
      },
    });

    // Update the ProcessBIA status if a new status was provided
    if (newStatus) {
      await prisma.processBIA.update({
        where: { id: processBIA.id },
        data: {
          status: newStatus,
          ...(newStatus === "Approved" && { approvedAt: new Date() }),
        },
      });
    }

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Error adding BIA comment:", error);
    return NextResponse.json(
      { error: "Failed to add BIA comment" },
      { status: 500 }
    );
  }
}
