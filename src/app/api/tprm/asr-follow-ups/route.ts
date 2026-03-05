import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";

// GET follow-ups data for assessor (clarifications and remediations)
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get("type") || "clarifications";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");

      const tenantFilter = getTenantFilter(session);

      if (type === "clarifications") {
        const clarifications = await prisma.tPRMClarification.findMany({
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

        const data = clarifications.map((c) => ({
          id: c.id,
          department: null,
          vendorId: c.assessment?.vendor?.vendorCode || null,
          vendorName: c.assessment?.vendor?.name || null,
          questionNo: c.questionNo || null,
          date: c.createdAt?.toISOString() || null,
          domain: c.domainName || null,
          status: c.status || "Open",
        }));

        return NextResponse.json({ data, total: data.length });
      }

      if (type === "remediations") {
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

        const data = remediations.map((r) => ({
          id: r.id,
          issueId: r.id.substring(0, 8) || null,
          vendorName: r.assessment?.vendor?.name || null,
          engagementId: r.assessment?.assessmentCode || null,
          domain: r.domainName || null,
          severity: r.severity || null,
          responseDate: r.requestedDate?.toISOString() || null,
          dueDate: r.dueDate?.toISOString() || null,
          reassignStatus: r.status === "Pending" ? "Not Assigned" : "Assigned to BO",
          status: r.status || "Open",
        }));

        return NextResponse.json({ data, total: data.length });
      }

      return NextResponse.json({ data: [], total: 0 });
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      return NextResponse.json({ error: "Failed to fetch follow-ups" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-follow-ups", action: "view" }
);
