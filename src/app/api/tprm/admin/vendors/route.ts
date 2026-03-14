import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

// GET — Superadmin: list all vendors across all customers grouped by name
export const GET = withAuth(
  async (_req, _context, _session) => {
    try {
      const vendors = await prisma.tPRMVendor.findMany({
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        include: {
          customerAccount: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          monitoringVendor: {
            select: {
              id: true, vendorName: true, vendorURL: true,
              assessments: {
                where: { isLatest: true },
                take: 1,
                select: {
                  overallScore: true, securityPostureScore: true, threatExposureScore: true,
                  calculatedOverallScore: true, calculatedSecurityPosture: true, calculatedThreatExposure: true,
                },
              },
            },
          },
          _count: { select: { assessments: true } },
        },
      });

      return NextResponse.json(vendors);
    } catch (error) {
      console.error("Error fetching admin vendors:", error);
      return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
    }
  },
  { resource: "tprm.account-overview", action: "view" }
);
