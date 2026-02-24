import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/internal-audit/engagements/[id]/comments - Fetch all comments for an engagement
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const comments = await prisma.engagementComment.findMany({
        where: { engagementId: id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              designation: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ data: comments });
    } catch (error) {
      console.error("Error fetching engagement comments:", error);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.fieldwork", action: "view" }
);

// POST /api/internal-audit/engagements/[id]/comments - Add a new comment
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const { comment } = await req.json();

      if (!comment || !comment.trim()) {
        return NextResponse.json(
          { error: "Comment cannot be empty" },
          { status: 400 }
        );
      }

      const newComment = await prisma.engagementComment.create({
        data: {
          engagementId: id,
          userId: session.id,
          comment: comment.trim(),
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              designation: true,
            },
          },
        },
      });

      return NextResponse.json({ data: newComment }, { status: 201 });
    } catch (error) {
      console.error("Error adding engagement comment:", error);
      return NextResponse.json(
        { error: "Failed to add comment" },
        { status: 500 }
      );
    }
  },
  { resource: "audit.fieldwork", action: "edit" }
);
