import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET issue register data for assessor
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);

      // Get issue remediations grouped by vendor
      const remediations = await prisma.tPRMIssueRemediation.findMany({
        where: { ...tenantFilter },
        include: {
          assessment: {
            include: {
              vendor: true,
            },
          },
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
      });

      // Group by vendor
      const vendorMap: Record<
        string,
        {
          department: string | null;
          businessOwner: string | null;
          vendor: string;
          vendorId: string;
          high: number;
          medium: number;
          low: number;
          total: number;
          status: string;
        }
      > = {};

      for (const rem of remediations) {
        const vendorName = rem.assessment?.vendor?.name || "Unknown";
        const vendorCode = rem.assessment?.vendor?.vendorCode || "";
        const key = `${vendorName}-${vendorCode}`;

        if (!vendorMap[key]) {
          vendorMap[key] = {
            department: null,
            businessOwner: null,
            vendor: vendorName,
            vendorId: vendorCode,
            high: 0,
            medium: 0,
            low: 0,
            total: 0,
            status: "Open",
          };
        }

        const severity = rem.severity || "Medium";
        if (severity === "High") vendorMap[key].high++;
        else if (severity === "Medium") vendorMap[key].medium++;
        else vendorMap[key].low++;
        vendorMap[key].total++;

        // Determine overall status
        if (rem.status === "Overdue") vendorMap[key].status = "Overdue";
      }

      const data = Object.values(vendorMap).map((entry, idx) => ({
        id: `issue-${idx}`,
        ...entry,
      }));

      return NextResponse.json({ data, total: data.length });
    } catch (error) {
      console.error("Error fetching issue register:", error);
      return NextResponse.json({ error: "Failed to fetch issue register" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-issue-register", action: "view" }
);
