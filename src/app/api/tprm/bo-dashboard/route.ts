import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter, getCustomerAccountId } from "@/lib/api-auth";

// GET — BO Dashboard data: all chart data in one call
export const GET = withAuth(
  async (_req, _context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // 1. Assessment Progress — count by status (Initiated, In Progress, Completed)
      const assessmentStatusCounts = await prisma.tPRMAssessment.groupBy({
        by: ["status"],
        where: { ...tenantFilter, NOT: { status: { startsWith: "Offboard" } } },
        _count: { id: true },
      });

      const assessmentProgress = {
        Initiated: 0,
        "In Progress": 0,
        Completed: 0,
      };
      for (const item of assessmentStatusCounts) {
        const s = item.status;
        if (s === "Initiated" || s === "Pending") assessmentProgress["Initiated"] += item._count.id;
        else if (s === "In Progress" || s === "In-Progress") assessmentProgress["In Progress"] += item._count.id;
        else if (s === "Completed" || s === "Approved") assessmentProgress["Completed"] += item._count.id;
      }

      // 2. Inherent Risk (Vendor VRR distribution) — pie chart
      const vendorVrrCounts = await prisma.tPRMVendor.groupBy({
        by: ["vrr"],
        where: { ...tenantFilter, vrr: { not: null } },
        _count: { id: true },
      });

      const inherentRisk: Record<string, number> = {
        Critical: 0, High: 0, Moderate: 0, Low: 0, Nominal: 0,
      };
      for (const item of vendorVrrCounts) {
        const vrr = item.vrr || "";
        if (vrr in inherentRisk) inherentRisk[vrr] = item._count.id;
      }

      // 3. Assessment Result — count by final result (Satisfactory, Unsatisfactory, Deficient)
      const assessmentResultCounts = await prisma.tPRMAssessment.groupBy({
        by: ["assessmentResult"],
        where: { ...tenantFilter, assessmentResult: { not: null } },
        _count: { id: true },
      });

      const assessmentResult: Record<string, number> = {
        Satisfactory: 0, Unsatisfactory: 0, Deficient: 0,
      };
      for (const item of assessmentResultCounts) {
        const r = item.assessmentResult || "";
        if (r in assessmentResult) assessmentResult[r] = item._count.id;
      }

      // Fetch control center config for remediation days
      const customerAccountId = getCustomerAccountId(session);
      const config = await prisma.tPRMConfiguration.findUnique({
        where: { customerAccountId },
        select: {
          remediationCritical: true, remediationHigh: true,
          remediationModerate: true, remediationLow: true, remediationNominal: true,
        },
      });
      const remediationDays: Record<string, number> = {
        Critical: config?.remediationCritical ?? 7,
        High: config?.remediationHigh ?? 14,
        Medium: config?.remediationModerate ?? 30,
        Moderate: config?.remediationModerate ?? 30,
        Low: config?.remediationLow ?? 60,
        Nominal: config?.remediationNominal ?? 90,
      };

      // 4-6. Issues from TPRMIssueRemediation
      const allRemediations = await prisma.tPRMIssueRemediation.findMany({
        where: { customerAccountId },
        select: { status: true, severity: true, createdAt: true, dueDate: true, domainName: true, assessment: { select: { vendorId: true } } },
      });

      const now = new Date();
      let openCount = 0, overdueCount = 0, closedCount = 0;
      const openIssuesBySeverity: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
      const overdueIssuesBySeverity: Record<string, number> = { High: 0, Medium: 0, Low: 0 };

      for (const rem of allRemediations) {
        const s = (rem.status || "").toLowerCase();
        if (s === "closed") {
          closedCount++;
        } else {
          // Non-closed = open
          openCount++;
          const sev = rem.severity || "Low";
          const sevKey = sev === "Critical" ? "High" : (sev in openIssuesBySeverity ? sev : "Low");
          openIssuesBySeverity[sevKey] = (openIssuesBySeverity[sevKey] || 0) + 1;

          // Check if overdue: compare createdAt + remediation days vs now
          const remDays = remediationDays[sev] || 30;
          const dueDate = rem.dueDate ? new Date(rem.dueDate) : new Date(rem.createdAt.getTime() + remDays * 24 * 60 * 60 * 1000);
          if (dueDate < now) {
            overdueCount++;
            overdueIssuesBySeverity[sevKey] = (overdueIssuesBySeverity[sevKey] || 0) + 1;
          }
        }
      }
      const issueStatus = { Open: openCount, Overdue: overdueCount, Closed: closedCount };

      // 7. Top 5 Vendors by remediation issue count (grouped by severity)
      const vendorIssueMap: Record<string, { high: number; medium: number; low: number }> = {};
      for (const rem of allRemediations) {
        const vid = rem.assessment?.vendorId;
        if (!vid) continue;
        if (!vendorIssueMap[vid]) vendorIssueMap[vid] = { high: 0, medium: 0, low: 0 };
        const sev = (rem.severity || "Low").toLowerCase();
        if (sev === "high" || sev === "critical") vendorIssueMap[vid].high++;
        else if (sev === "medium" || sev === "moderate") vendorIssueMap[vid].medium++;
        else vendorIssueMap[vid].low++;
      }

      const vendorIds = Object.keys(vendorIssueMap);
      const vendors = vendorIds.length > 0
        ? await prisma.tPRMVendor.findMany({
            where: { id: { in: vendorIds } },
            select: { id: true, name: true },
          })
        : [];
      const vendorNameMap = new Map(vendors.map((v) => [v.id, v.name]));

      const top5Vendors = Object.entries(vendorIssueMap)
        .map(([id, counts]) => ({
          name: vendorNameMap.get(id) || "Unknown",
          high: counts.high,
          medium: counts.medium,
          low: counts.low,
          total: counts.high + counts.medium + counts.low,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // 8. Top 5 Domains by remediation issue count
      const domainIssueMap: Record<string, { high: number; medium: number; low: number }> = {};
      for (const rem of allRemediations) {
        const dName = rem.domainName || "Unknown";
        if (!domainIssueMap[dName]) domainIssueMap[dName] = { high: 0, medium: 0, low: 0 };
        const sev = (rem.severity || "Low").toLowerCase();
        if (sev === "high" || sev === "critical") domainIssueMap[dName].high++;
        else if (sev === "medium" || sev === "moderate") domainIssueMap[dName].medium++;
        else domainIssueMap[dName].low++;
      }

      const top5Domains = Object.entries(domainIssueMap)
        .filter(([name]) => name !== "Unknown")
        .map(([name, counts]) => ({
          name,
          high: counts.high,
          medium: counts.medium,
          low: counts.low,
          total: counts.high + counts.medium + counts.low,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      return NextResponse.json({
        assessmentProgress,
        inherentRisk,
        assessmentResult,
        issueStatus,
        openIssuesBySeverity,
        overdueIssuesBySeverity,
        top5Vendors,
        top5Domains,
      });
    } catch (error) {
      console.error("BO Dashboard API error:", error);
      return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }
  },
  { resource: "tprm.bo-dashboard", action: "view" }
);
