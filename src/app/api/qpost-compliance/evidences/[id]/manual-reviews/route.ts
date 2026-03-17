import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all manual reviews for an evidence
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const reviews = await prisma.qPostEvidenceManualReview.findMany({
        where: { evidenceId: id },
        include: {
          reviewer: {
            select: {
              id: true,
              userName: true,
              fullName: true,
            },
          },
        },
        orderBy: { reviewDate: "desc" },
      });

      return NextResponse.json(reviews);
    } catch (error) {
      console.error("Error fetching manual reviews:", error);
      return NextResponse.json(
        { error: "Failed to fetch manual reviews" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "view" }
);

// POST create a new manual review
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { status, score, comments, findings, recommendation } = body;

      // Verify evidence exists
      const evidence = await prisma.qPostEvidence.findUnique({
        where: { id },
        select: { id: true, name: true, evidenceCode: true, customerAccountId: true, assigneeId: true, approverId: true, status: true },
      });

      if (!evidence) {
        return NextResponse.json(
          { error: "Evidence not found" },
          { status: 404 }
        );
      }

      const review = await prisma.qPostEvidenceManualReview.create({
        data: {
          evidenceId: id,
          reviewerId: session.id,
          status: status || "Reviewed",
          score: score !== undefined && score !== null && score !== "" ? parseFloat(score) : null,
          comments: comments || null,
          findings: findings || null,
          recommendation: recommendation || null,
        },
        include: {
          reviewer: {
            select: {
              id: true,
              userName: true,
              fullName: true,
            },
          },
        },
      });

      // Trigger background translation
      if (evidence.customerAccountId) {
        void translateRecord(evidence.customerAccountId, "QPostEvidenceManualReview", review.id, {
          comments: review.comments || "",
          findings: review.findings || "",
          recommendation: review.recommendation || "",
        });
      }

      // Notify assignee that review has been submitted
      try {
        if (evidence.assigneeId) {
          void notificationService.send({
            customerAccountId: evidence.customerAccountId,
            actorId: session.id,
            recipientId: evidence.assigneeId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_APPROVED,
            title: "Evidence Review Completed",
            message: `A manual review has been submitted for evidence "${evidence.name}"`,
            link: `/qpost-compliance/evidence/${id}`,
            relatedEntityType: "evidence",
            relatedEntityId: id,
            channels: [NOTIFICATION_CHANNELS.INBOX, NOTIFICATION_CHANNELS.EMAIL],
          });
        }
      } catch (notifError) {
        console.error("Error sending review notification:", notifError);
      }

      return NextResponse.json(review, { status: 201 });
    } catch (error) {
      console.error("Error creating manual review:", error);
      return NextResponse.json(
        { error: "Failed to create manual review" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "edit" }
);

// DELETE a manual review
export const DELETE = withAuth(
  async (req: NextRequest) => {
    try {
      const { searchParams } = new URL(req.url);
      const reviewId = searchParams.get("reviewId");

      if (!reviewId) {
        return NextResponse.json(
          { error: "reviewId is required" },
          { status: 400 }
        );
      }

      await prisma.qPostEvidenceManualReview.delete({
        where: { id: reviewId },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting manual review:", error);
      return NextResponse.json(
        { error: "Failed to delete manual review" },
        { status: 500 }
      );
    }
  },
  { resource: "qpost-compliance.evidence", action: "delete" }
);
