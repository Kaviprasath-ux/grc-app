import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET cycle comments for a specific evidence + cycle period
export const GET = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(req.url);
      const cyclePeriod = searchParams.get("cyclePeriod");

      if (!cyclePeriod) {
        return NextResponse.json(
          { error: "cyclePeriod query parameter is required" },
          { status: 400 }
        );
      }

      // Check if evidence belongs to user's tenant
      const evidence = await prisma.evidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      const comments = await prisma.evidenceCycleComment.findMany({
        where: {
          evidenceId: id,
          cyclePeriod,
        },
        orderBy: { createdAt: "asc" },
      });

      return NextResponse.json(comments);
    } catch (error) {
      console.error("Error fetching cycle comments:", error);
      return NextResponse.json(
        { error: "Failed to fetch cycle comments" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

// POST create a new cycle comment (sendback or resubmit)
export const POST = withAuth(
  async (req, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { cyclePeriod, action, comment } = body;

      if (!cyclePeriod || !action || !comment) {
        return NextResponse.json(
          { error: "cyclePeriod, action, and comment are required" },
          { status: 400 }
        );
      }

      if (!["sendback", "resubmit"].includes(action)) {
        return NextResponse.json(
          { error: "action must be 'sendback' or 'resubmit'" },
          { status: 400 }
        );
      }

      // Check if evidence belongs to user's tenant
      const evidence = await prisma.evidence.findUnique({
        where: { id },
        select: { customerAccountId: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      const newComment = await prisma.evidenceCycleComment.create({
        data: {
          evidenceId: id,
          cyclePeriod,
          action,
          comment,
          userId: session.id || null,
          userName: session.name || null,
        },
      });

      return NextResponse.json(newComment, { status: 201 });
    } catch (error) {
      console.error("Error creating cycle comment:", error);
      return NextResponse.json(
        { error: "Failed to create cycle comment" },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "edit" }
);
