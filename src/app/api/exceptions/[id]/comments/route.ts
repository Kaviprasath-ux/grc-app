import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all comments for an exception
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comments = await prisma.exceptionComment.findMany({
      where: { exceptionId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching exception comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch exception comments" },
      { status: 500 }
    );
  }
}

// POST create new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, userId, userName } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    const comment = await prisma.exceptionComment.create({
      data: {
        exceptionId: id,
        content,
        userId,
        userName,
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating exception comment:", error);
    return NextResponse.json(
      { error: "Failed to create exception comment" },
      { status: 500 }
    );
  }
}
