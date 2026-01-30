import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET dashboard statistics with multi-tenant filtering
export async function GET() {
  try {
    const session = await auth();

    // Multi-tenant: Build filter based on customerAccountId
    const userRoles = session?.user?.roles || [];
    const isGRCAdmin = userRoles.includes("GRCAdministrator");
    const customerAccountId = session?.user?.customerAccountId;

    // Build tenant filter (GRCAdmin sees all, others see only their tenant)
    const tenantFilter = !isGRCAdmin && customerAccountId
      ? { customerAccountId }
      : {};

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
    const riskAssessmentData = riskCategories.map((category) => {
      const categoryRisks = risks.filter((r) => r.riskRating === category);
      const closedRisks = categoryRisks.filter((r) => r.status === "Closed");
      return {
        category,
        total: categoryRisks.length,
        closed: closedRisks.length,
      };
    });

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
    const governanceStatusData = governanceTypes.map((type) => {
      const typePolicies = policies.filter((p) => p.documentType === type);
      return {
        type,
        notUploaded: typePolicies.filter((p) => !p.status || p.status === "Not Uploaded").length,
        draft: typePolicies.filter((p) => p.status === "Draft").length,
        approved: typePolicies.filter((p) => p.status === "Approved").length,
        needsReview: typePolicies.filter((p) => p.status === "Needs Review").length,
        published: typePolicies.filter((p) => p.status === "Published").length,
      };
    });

    // Fetch exception status
    const exceptionTypes = ["Control", "Compliance", "Policy"];
    const exceptionStatusData = exceptionTypes.map((type) => {
      const typeExceptions = exceptions.filter((e) => e.category === type);
      return {
        type,
        pending: typeExceptions.filter((e) => e.status === "Pending").length,
        approved: typeExceptions.filter((e) => e.status === "Approved").length,
        authorized: typeExceptions.filter((e) => e.status === "Authorised").length,
        closed: typeExceptions.filter((e) => e.status === "Closed").length,
        overdue: typeExceptions.filter((e) => e.status === "Overdue").length,
      };
    });

    // Evidence KPI - fetch from database with tenant filtering
    // Get departments for this tenant and their evidence counts
    const departments = await prisma.department.findMany({
      where: tenantFilter,
      select: { id: true, name: true },
    });

    const evidenceKPIData = await Promise.all(
      departments.map(async (dept) => {
        const evidences = await prisma.evidence.findMany({
          where: {
            ...tenantFilter,
            departmentId: dept.id,
          },
          select: { status: true },
        });
        return {
          department: dept.name,
          achieved: evidences.filter((e) => e.status === "Approved" || e.status === "Completed").length,
          scheduled: evidences.filter((e) => e.status === "Scheduled" || e.status === "Pending").length,
          missed: evidences.filter((e) => e.status === "Missed" || e.status === "Rejected").length,
          overdue: evidences.filter((e) => e.status === "Overdue").length,
        };
      })
    );

    // Process KPI - fetch from database with tenant filtering
    const processKPIData = await Promise.all(
      departments.map(async (dept) => {
        const processes = await prisma.process.findMany({
          where: {
            ...tenantFilter,
            departmentId: dept.id,
          },
          select: { status: true },
        });
        return {
          department: dept.name,
          achieved: processes.filter((p) => p.status === "Approved" || p.status === "Active").length,
          scheduled: processes.filter((p) => p.status === "Scheduled" || p.status === "Draft").length,
          missed: processes.filter((p) => p.status === "Missed" || p.status === "Inactive").length,
          overdue: processes.filter((p) => p.status === "Overdue").length,
        };
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
}
