import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getCustomerAccountId } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string; docId: string }>;
}

// POST — RM/BO requests contract deletion
export const POST = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id: vendorId, docId } = await context.params;
      const customerAccountId = getCustomerAccountId(session);
      const { reason } = (await req.json()) as { reason?: string };

      if (!reason?.trim()) {
        return NextResponse.json({ error: "Reason is required" }, { status: 400 });
      }

      // Verify document belongs to this vendor and customer
      const doc = await prisma.tPRMVendorDocument.findFirst({
        where: { id: docId, vendorId, customerAccountId, isDeleted: false },
      });
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      // Get vendor name for notification
      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id: vendorId },
        select: { name: true },
      });

      // Check if there's already a pending request for this document
      const existing = await prisma.tPRMContractDeletionRequest.findFirst({
        where: { documentId: docId, status: "Pending" },
      });
      if (existing) {
        return NextResponse.json({ error: "A deletion request is already pending for this document" }, { status: 409 });
      }

      const request = await prisma.tPRMContractDeletionRequest.create({
        data: {
          customerAccountId,
          documentId: docId,
          vendorId,
          reason: reason.trim(),
          requestedBy: session.id,
        },
      });

      // Notify superadmins (GRCAdministrator users)
      try {
        const superadmins = await prisma.user.findMany({
          where: { isActive: true, role: "GRCAdministrator" },
          select: { id: true },
          take: 20,
        });
        const recipientIds = superadmins.map((u) => u.id);
        if (recipientIds.length > 0) {
          void notificationService.notifyTPRMContractDeletionRequested({
            customerAccountId,
            actorId: session.id,
            recipientIds,
            vendorName: vendor?.name || "Unknown",
            fileName: doc.fileName,
            reason: reason.trim(),
          });
        }
      } catch (notifErr) {
        console.error("Notification error:", notifErr);
      }

      return NextResponse.json(request, { status: 201 });
    } catch (error) {
      console.error("Error creating deletion request:", error);
      return NextResponse.json({ error: "Failed to create deletion request" }, { status: 500 });
    }
  },
  { resource: ["tprm.bo-inventory", "tprm.rm-inventory"], action: "edit" }
);
