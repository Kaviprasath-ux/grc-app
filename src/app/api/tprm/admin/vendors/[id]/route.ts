import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";
import { notificationService } from "@/lib/notification-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET — Superadmin: get vendor detail with documents (including deleted)
export const GET = withAuth<RouteContext>(
  async (_req, context, _session) => {
    try {
      const { id } = await context.params;

      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id },
        include: {
          customerAccount: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          vendorDocuments: {
            orderBy: { createdAt: "desc" },
            include: {
              deletedByUser: { select: { id: true, fullName: true } },
            },
          },
        },
      });

      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }

      return NextResponse.json(vendor);
    } catch (error) {
      console.error("Error fetching admin vendor detail:", error);
      return NextResponse.json({ error: "Failed to fetch vendor" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "view" }
);

// DELETE — Superadmin: soft-delete a vendor document
export const DELETE = withAuth<RouteContext>(
  async (req, context, session) => {
    try {
      const { id: vendorId } = await context.params;
      const { documentId, reason } = (await req.json()) as { documentId: string; reason?: string };

      if (!documentId) {
        return NextResponse.json({ error: "documentId is required" }, { status: 400 });
      }

      const doc = await prisma.tPRMVendorDocument.findFirst({
        where: { id: documentId, vendorId, isDeleted: false },
      });
      if (!doc) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      // Get vendor info for notification
      const vendor = await prisma.tPRMVendor.findUnique({
        where: { id: vendorId },
        select: { name: true, customerAccountId: true },
      });

      await prisma.tPRMVendorDocument.update({
        where: { id: documentId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: session.id,
          deletionReason: reason?.trim() || "Deleted by superadmin",
        },
      });

      // Notify vendor's account managers and relationship managers
      if (vendor) {
        try {
          const tprmUsers = await prisma.user.findMany({
            where: {
              customerAccountId: vendor.customerAccountId,
              isActive: true,
              tprmRole: { in: ["Account Manager", "Relationship Manager", "Business Owner"] },
            },
            select: { id: true },
            take: 20,
          });
          const recipientIds = tprmUsers.map((u) => u.id);
          if (recipientIds.length > 0) {
            void notificationService.notifyTPRMContractDeletedByAdmin({
              customerAccountId: vendor.customerAccountId,
              actorId: session.id,
              recipientIds,
              vendorName: vendor.name,
              fileName: doc.fileName,
              reason: reason?.trim(),
            });
          }
        } catch (notifErr) {
          console.error("Notification error:", notifErr);
        }
      }

      return NextResponse.json({ message: "Document archived successfully" });
    } catch (error) {
      console.error("Error deleting vendor document:", error);
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "delete" }
);
