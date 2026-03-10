import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET issue register data for assessor
export const GET = withAuth(
  async (req, context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const tab = searchParams.get("tab") || "register";
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);

      // ==================== TAB 1: ISSUE REGISTER ====================
      if (tab === "register") {
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

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
            id: string;
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
          const vendor = rem.assessment?.vendor;
          const vendorName = vendor?.name || "Unknown";
          const vendorCode = vendor?.vendorCode || "";
          const vendorDbId = vendor?.id || `unknown-${vendorName}`;
          const key = vendorDbId;

          if (!vendorMap[key]) {
            vendorMap[key] = {
              id: vendorDbId,
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

          if (rem.status === "Overdue") vendorMap[key].status = "Overdue";
        }

        const data = Object.values(vendorMap);
        return NextResponse.json({ data, total: data.length });
      }

      // ==================== TAB 2: REGISTER DETAIL (per-vendor issues) ====================
      if (tab === "register-detail") {
        const vendorId = searchParams.get("vendorId");
        if (!vendorId) {
          return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
        }

        const vendor = await prisma.tPRMVendor.findFirst({
          where: { id: vendorId, customerAccountId },
          select: { name: true },
        });

        const allRemediations = await prisma.tPRMIssueRemediation.findMany({
          where: {
            customerAccountId,
            assessment: { vendorId },
          },
          include: {
            assessment: {
              select: { id: true, assessmentCode: true },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        // Deduplicate: keep latest remediation per assessmentId+questionNo
        const seen = new Set<string>();
        const remediations = allRemediations.filter((rem) => {
          const key = `${rem.assessmentId}:${rem.questionNo || rem.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const data = remediations.map((rem, idx) => ({
          id: rem.id,
          remediationId: rem.id,
          domain: rem.domainName || null,
          severity: rem.severity || "Medium",
          issue: rem.issue || null,
          risk: rem.risk || null,
          recommendation: rem.recommendation || null,
          assessmentCode: rem.assessment?.assessmentCode || null,
          dueDate: rem.dueDate?.toISOString() || null,
          status: rem.status || "Open",
          issueCode: rem.issueCode || `ISS-${String(idx + 1).padStart(3, "0")}`,
          questionNo: rem.questionNo || null,
        }));

        return NextResponse.json({ data, total: data.length, vendorName: vendor?.name || "Unknown" });
      }

      return NextResponse.json({ error: "Invalid tab parameter" }, { status: 400 });
    } catch (error) {
      console.error("Error fetching issue register:", error);
      return NextResponse.json({ error: "Failed to fetch issue register" }, { status: 500 });
    }
  },
  { resource: "tprm.asr-issue-register", action: "view" }
);
