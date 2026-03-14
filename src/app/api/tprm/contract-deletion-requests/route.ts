import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET — Superadmin lists all contract deletion requests
export const GET = withAuth(
  async (_req, _context, _session) => {
    try {
      const requests = await prisma.tPRMContractDeletionRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          document: { select: { id: true, fileName: true, docType: true, filePath: true, isDeleted: true } },
          vendor: { select: { id: true, name: true, vendorCode: true, engagementId: true } },
          customerAccount: { select: { id: true, name: true } },
          requestedByUser: { select: { id: true, fullName: true, tprmRole: true } },
          reviewedByUser: { select: { id: true, fullName: true } },
        },
      });

      return NextResponse.json(requests);
    } catch (error) {
      console.error("Error fetching deletion requests:", error);
      return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "view" }
);
