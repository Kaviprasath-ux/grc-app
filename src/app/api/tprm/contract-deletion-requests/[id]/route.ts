import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH — Superadmin approves or rejects a deletion request
export const PATCH = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id } = await context.params;
      const { action, reviewNote } = (await req.json()) as {
        action: "Approved" | "Rejected";
        reviewNote?: string;
      };

      if (!["Approved", "Rejected"].includes(action)) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      const request = await prisma.tPRMContractDeletionRequest.findFirst({
        where: { id, status: "Pending" },
        include: {
          document: true,
          vendor: { select: { name: true } },
        },
      });

      if (!request) {
        return NextResponse.json({ error: "Pending request not found" }, { status: 404 });
      }

      // Update request status
      const updated = await prisma.tPRMContractDeletionRequest.update({
        where: { id },
        data: {
          status: action,
          reviewedBy: session.id,
          reviewedAt: new Date(),
          reviewNote: reviewNote?.trim() || null,
        },
      });

      // If approved, soft-delete the document
      if (action === "Approved") {
        await prisma.tPRMVendorDocument.update({
          where: { id: request.documentId },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: session.id,
            deletionReason: request.reason,
          },
        });
      }

      // Notify the requester
      try {
        if (action === "Approved") {
          void notificationService.notifyTPRMContractDeletionApproved({
            customerAccountId: request.customerAccountId,
            actorId: session.id,
            recipientIds: [request.requestedBy],
            vendorName: request.vendor.name,
            fileName: request.document.fileName,
          });
        } else {
          void notificationService.notifyTPRMContractDeletionRejected({
            customerAccountId: request.customerAccountId,
            actorId: session.id,
            recipientIds: [request.requestedBy],
            vendorName: request.vendor.name,
            fileName: request.document.fileName,
            reviewNote: reviewNote?.trim(),
          });
        }
      } catch (notifErr) {
        console.error("Notification error:", notifErr);
      }

      return NextResponse.json(updated);
    } catch (error) {
      console.error("Error reviewing deletion request:", error);
      return NextResponse.json({ error: "Failed to review request" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "edit" }
);
