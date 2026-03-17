import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { translateRecord } from "@/lib/translation-service";
import { notificationService, NOTIFICATION_EVENTS, NOTIFICATION_CHANNELS } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET all manual reviews for a policy
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id } = await context.params;

      const reviews = await prisma.qPostPolicyManualReview.findMany({
        where: { policyId: id },
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
  { resource: "qpost-compliance.governance", action: "view" }
);

// POST create a new manual review
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { status, score, comments, findings, recommendation } = body;

      // Verify policy exists
      const policy = await prisma.qPostPolicy.findUnique({
        where: { id },
        select: { id: true, customerAccountId: true, assigneeId: true, name: true, code: true },
      });

      if (!policy) {
        return NextResponse.json(
          { error: "Policy not found" },
          { status: 404 }
        );
      }

      const review = await prisma.qPostPolicyManualReview.create({
        data: {
          policyId: id,
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
      if (policy.customerAccountId) {
        void translateRecord(policy.customerAccountId, "QPostPolicyManualReview", review.id, {
          comments: review.comments || "",
          findings: review.findings || "",
          recommendation: review.recommendation || "",
        });
      }

      // Notify assignee that review has been submitted
      try {
        if (policy.assigneeId) {
          void notificationService.send({
            customerAccountId: policy.customerAccountId,
            actorId: session.id,
            recipientId: policy.assigneeId,
            event: NOTIFICATION_EVENTS.GOVERNANCE_APPROVED,
            title: "Manual Review Completed",
            message: `A manual review has been submitted for "${policy.name}"`,
            link: `/qpost-compliance/governance/${id}`,
            relatedEntityType: "governance",
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
  { resource: "qpost-compliance.governance", action: "edit" }
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

      await prisma.qPostPolicyManualReview.delete({
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
  { resource: "qpost-compliance.governance", action: "delete" }
);
