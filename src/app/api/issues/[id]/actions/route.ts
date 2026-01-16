import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all actions for an issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const actions = await prisma.issueAction.findMany({
      where: { issueId: id },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(actions);
  } catch (error) {
    console.error("Error fetching issue actions:", error);
    return NextResponse.json(
      { error: "Failed to fetch issue actions" },
      { status: 500 }
    );
  }
}

// POST create a new action for an issue
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actionType, description, completion, comment, createdById, fileName, fileType, filePath, fileSize } = body;

    if (!actionType || !description || !createdById) {
      return NextResponse.json(
        { error: "Action type, description, and creator are required" },
        { status: 400 }
      );
    }

    // Verify the issue exists
    const issue = await prisma.issue.findUnique({
      where: { id },
    });

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const action = await prisma.issueAction.create({
      data: {
        issueId: id,
        actionType,
        description,
        completion: completion || 0,
        comment: comment || null,
        createdById,
        status: "Pending",
        fileName: fileName || null,
        fileType: fileType || null,
        filePath: filePath || null,
        fileSize: fileSize || null,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true },
        },
        comments: true,
      },
    });

    return NextResponse.json(action, { status: 201 });
  } catch (error) {
    console.error("Error creating issue action:", error);
    return NextResponse.json(
      { error: "Failed to create issue action" },
      { status: 500 }
    );
  }
}
