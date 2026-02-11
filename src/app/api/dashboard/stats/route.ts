import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, getTenantFilter } from "@/lib/api-auth";
import { NextRequest } from "next/server";

// GET dashboard statistics with multi-tenant filtering
export const GET = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      const tenantFilter = getTenantFilter(session);

      // Fetch counts with tenant filtering
      const [
        departmentsCount,
        stakeholdersCount,
        regulationsCount,
        issuesCount,
        risksCount,
        exceptionsCount,
      ] = await Promise.all([
        prisma.department.count({ where: tenantFilter }),
        prisma.stakeholder.count({ where: tenantFilter }),
        prisma.regulation.count({ where: tenantFilter }),
        prisma.issue.count({ where: tenantFilter }),
        prisma.risk.count({ where: tenantFilter }),
        prisma.exception.count({ where: tenantFilter }),
      ]);

      const dashboardStats = {
        departments: departmentsCount,
        stakeholders: stakeholdersCount,
        regulations: regulationsCount,
        issues: issuesCount,
        risks: risksCount,
        exceptions: exceptionsCount,
      };

      // Fetch compliance data by framework
      const frameworks = await prisma.framework.findMany({
        where: tenantFilter,
        include: {
          controls: {
            where: tenantFilter,
            select: { status: true },
          },
        },
      });

      const complianceData = frameworks.map((framework) => {
        const total = framework.controls.length;
        const compliant = framework.controls.filter(
          (c) => c.status === "Compliant"
        ).length;
        const compliantPercent = total > 0 ? Math.round((compliant / total) * 100) : 0;
        return {
          frameworkId: framework.id,
          framework: framework.name.length > 15
            ? framework.name.substring(0, 15) + "..."
            : framework.name,
          compliant: compliantPercent,
          nonCompliant: 100 - compliantPercent,
        };
      });

      // Fetch risk assessment overview
      const risks = await prisma.risk.findMany({
        where: tenantFilter,
        select: { riskRating: true, status: true },
      });

      const riskCategories = ["Low Risk", "High", "Very high", "Catastrophic"];
      const riskAssessmentData = riskCategories
        .map((category) => {
          const categoryRisks = risks.filter((r) => r.riskRating === category);
          const closedRisks = categoryRisks.filter((r) => r.status === "Closed");
          return {
            category,
            total: categoryRisks.length,
            closed: closedRisks.length,
          };
        })
        .filter((item) => item.total > 0);

      // Fetch issues by category
      const issues = await prisma.issue.findMany({
        where: tenantFilter,
        select: { category: true },
      });

      const issueCategoryMap = new Map<string, number>();
      issues.forEach((issue) => {
        const cat = issue.category || "Uncategorized";
        issueCategoryMap.set(cat, (issueCategoryMap.get(cat) || 0) + 1);
      });

      // Design system chart colors
      const colors = ["#6366F1", "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6"];
      const issueByCategoryData = Array.from(issueCategoryMap.entries()).map(
        ([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        })
      );

      // Fetch issues by department
      const issuesWithDept = await prisma.issue.findMany({
        where: tenantFilter,
        include: { department: { select: { name: true } } },
      });

      const issueDeptMap = new Map<string, number>();
      issuesWithDept.forEach((issue) => {
        const dept = issue.department?.name || "Unassigned";
        issueDeptMap.set(dept, (issueDeptMap.get(dept) || 0) + 1);
      });

      const issueByDepartmentData = Array.from(issueDeptMap.entries()).map(
        ([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        })
      );

      // Fetch issues by domain
      const issueDomainMap = new Map<string, number>();
      issues.forEach((issue) => {
        // Assuming domain field or default categorization
        const domain = "Internal"; // Placeholder - adjust based on actual schema
        issueDomainMap.set(domain, (issueDomainMap.get(domain) || 0) + 1);
      });

      const issueByDomainData = Array.from(issueDomainMap.entries()).map(
        ([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        })
      );

      // Fetch exceptions by category
      const exceptions = await prisma.exception.findMany({
        where: tenantFilter,
        select: { category: true, status: true },
      });

      const exceptionTypeMap = new Map<string, number>();
      exceptions.forEach((exc) => {
        const type = exc.category || "Other";
        exceptionTypeMap.set(type, (exceptionTypeMap.get(type) || 0) + 1);
      });

      const exceptionByTypeData = Array.from(exceptionTypeMap.entries()).map(
        ([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        })
      );

      // Fetch governance status (policies)
      const policies = await prisma.policy.findMany({
        where: tenantFilter,
        select: { status: true, documentType: true },
      });

      const governanceTypes = ["Policy", "Procedure", "Standard"];
      const governanceStatusData = governanceTypes
        .map((type) => {
          const typePolicies = policies.filter((p) => p.documentType === type);
          return {
            type,
            notUploaded: typePolicies.filter((p) => !p.status || p.status === "Not Uploaded").length,
            draft: typePolicies.filter((p) => p.status === "Draft").length,
            approved: typePolicies.filter((p) => p.status === "Approved").length,
            needsReview: typePolicies.filter((p) => p.status === "Needs Review").length,
            published: typePolicies.filter((p) => p.status === "Published").length,
          };
        })
        .filter((item) => item.notUploaded + item.draft + item.approved + item.needsReview + item.published > 0);

      // Fetch exception status
      const exceptionTypes = ["Control", "Compliance", "Policy"];
      const exceptionStatusData = exceptionTypes
        .map((type) => {
          const typeExceptions = exceptions.filter((e) => e.category === type);
          return {
            type,
            pending: typeExceptions.filter((e) => e.status === "Pending").length,
            approved: typeExceptions.filter((e) => e.status === "Approved").length,
            authorized: typeExceptions.filter((e) => e.status === "Authorised").length,
            closed: typeExceptions.filter((e) => e.status === "Closed").length,
            overdue: typeExceptions.filter((e) => e.status === "Overdue").length,
          };
        })
        .filter((item) => item.pending + item.approved + item.authorized + item.closed + item.overdue > 0);

      // Evidence KPI - KPIs from the KPI model (linked to evidence)
      const allKPIs = await prisma.kPI.findMany({
        where: {
          ...tenantFilter,
          evidenceId: { not: null },
        },
        select: {
          status: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      });

      const evidenceByDeptMap = new Map<string, { achieved: number; scheduled: number; missed: number; overdue: number }>();

      allKPIs.forEach((kpi) => {
        const deptName = kpi.department?.name || "Unassigned";
        if (!evidenceByDeptMap.has(deptName)) {
          evidenceByDeptMap.set(deptName, { achieved: 0, scheduled: 0, missed: 0, overdue: 0 });
        }
        const deptStats = evidenceByDeptMap.get(deptName)!;

        // Categorize KPI by status
        if (kpi.status === "Achieved") {
          deptStats.achieved++;
        } else if (kpi.status === "Scheduled") {
          deptStats.scheduled++;
        } else if (kpi.status === "Missed") {
          deptStats.missed++;
        } else if (kpi.status === "Overdue") {
          deptStats.overdue++;
        }
      });

      const evidenceKPIData = Array.from(evidenceByDeptMap.entries()).map(
        ([department, stats]) => ({
          department,
          ...stats,
        })
      );

      // Process KPI - Processes with KPI Measurement Required enabled
      // Data source: Organization > Process > Performance Dashboard
      const kpiProcesses = await prisma.process.findMany({
        where: {
          ...tenantFilter,
          kpiMeasurementRequired: true,
        },
        select: {
          status: true,
          reviewDate: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      });

      const now = new Date();
      const processByDeptMap = new Map<string, { achieved: number; scheduled: number; missed: number; overdue: number }>();

      kpiProcesses.forEach((process) => {
        const deptName = process.department?.name || "Unassigned";
        if (!processByDeptMap.has(deptName)) {
          processByDeptMap.set(deptName, { achieved: 0, scheduled: 0, missed: 0, overdue: 0 });
        }
        const deptStats = processByDeptMap.get(deptName)!;

        // Categorize process by status and review date
        if (process.status === "Active" && process.reviewDate && new Date(process.reviewDate) <= now) {
          deptStats.achieved++;
        } else if (process.reviewDate && new Date(process.reviewDate) > now) {
          deptStats.scheduled++;
        } else if (process.status === "Inactive" || process.status === "Suspended") {
          deptStats.missed++;
        } else if (process.reviewDate && new Date(process.reviewDate) < now && process.status !== "Active") {
          deptStats.overdue++;
        } else {
          // Default to scheduled for active processes without review date
          deptStats.scheduled++;
        }
      });

      const processKPIData = Array.from(processByDeptMap.entries()).map(
        ([department, stats]) => ({
          department,
          ...stats,
        })
      );

      return NextResponse.json({
        dashboardStats,
        complianceData,
        riskAssessmentData,
        issueByCategoryData,
        issueByDepartmentData,
        issueByDomainData,
        exceptionByTypeData,
        evidenceKPIData,
        processKPIData,
        governanceStatusData,
        exceptionStatusData,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      return NextResponse.json(
        { error: "Failed to fetch dashboard stats" },
        { status: 500 }
      );
    }
  },
  { resource: "organization.dashboard", action: "view" }
);
