import prisma from "@/lib/prisma";
import { AuthenticatedRequest, getTenantFilter } from "@/lib/api-auth";
import { ReportData, ReportColumn } from "./types";

type Session = AuthenticatedRequest["user"];

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

// ────────────────────────────────────────────
// 1. QPost Compliance Summary
// ────────────────────────────────────────────
export async function fetchQPostComplianceSummary(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const [requirements, evidences, policies, exceptions, kpis, risks] =
    await Promise.all([
      prisma.qPostRequirement.findMany({ where: tf, select: { controlCompliance: true } }),
      prisma.qPostEvidence.findMany({ where: tf, select: { status: true } }),
      prisma.qPostPolicy.findMany({ where: tf, select: { status: true } }),
      prisma.qPostException.findMany({ where: tf, select: { status: true } }),
      prisma.qPostKPI.findMany({ where: tf, select: { status: true } }),
      prisma.risk.findMany({ where: tf, select: { status: true } }),
    ]);

  function countByStatus<T extends { status?: string | null }>(
    items: T[],
    compliantStatuses: string[],
    inProgressStatuses: string[],
    statusKey: keyof T = "status" as keyof T
  ) {
    const total = items.length;
    const compliant = items.filter((i) =>
      compliantStatuses.includes((i[statusKey] as string) || "")
    ).length;
    const inProgress = items.filter((i) =>
      inProgressStatuses.includes((i[statusKey] as string) || "")
    ).length;
    return { total, compliant, inProgress, nonCompliant: total - compliant - inProgress };
  }

  // For requirements, use controlCompliance as the status field
  const reqItems = requirements.map((r) => ({ status: r.controlCompliance || "" }));

  const data: Record<string, { total: number; compliant: number; inProgress: number; nonCompliant: number }> = {
    Controls: countByStatus(reqItems, ["Compliant"], ["Partial Compliant"]),
    Evidences: countByStatus(evidences, ["Published", "Validated"], ["Draft"]),
    Policies: countByStatus(policies, ["Published", "Approved"], ["Draft", "Pending Approval"]),
    Exceptions: countByStatus(exceptions, ["Closed"], ["Approved", "Authorised", "Pending"]),
    KPIs: countByStatus(kpis, ["Achieved"], ["Scheduled"]),
    Risks: countByStatus(risks, ["Closed"], ["In Progress", "Open"]),
  };

  const columns: ReportColumn[] = [
    { key: "category", header: "Category", width: 18 },
    { key: "total", header: "Total", width: 10 },
    { key: "compliant", header: "Compliant", width: 12 },
    { key: "inProgress", header: "In Progress", width: 12 },
    { key: "nonCompliant", header: "Non-Compliant", width: 14 },
    { key: "complianceRate", header: "Compliance %", width: 14 },
  ];

  const rows = Object.entries(data).map(([cat, v]) => ({
    category: cat,
    total: v.total,
    compliant: v.compliant,
    inProgress: v.inProgress,
    nonCompliant: v.nonCompliant,
    complianceRate: pct(v.compliant, v.total),
  }));

  const totals = rows.reduce(
    (a, r) => ({
      total: a.total + (r.total as number),
      compliant: a.compliant + (r.compliant as number),
    }),
    { total: 0, compliant: 0 }
  );

  return {
    title: "Compliance Summary Report",
    description: "Overall compliance status across all frameworks",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Items": totals.total,
      "Total Compliant": totals.compliant,
      "Overall Compliance Rate": pct(totals.compliant, totals.total),
    },
  };
}

// ────────────────────────────────────────────
// 2. QPost Control Effectiveness (Requirements)
// ────────────────────────────────────────────
export async function fetchQPostControlEffectiveness(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const requirements = await prisma.qPostRequirement.findMany({
    where: tf,
    include: {
      framework: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });

  const columns: ReportColumn[] = [
    { key: "controlCode", header: "Control Code", width: 14 },
    { key: "name", header: "Name", width: 28 },
    { key: "status", header: "Status", width: 14 },
    { key: "grouping", header: "Grouping", width: 14 },
    { key: "framework", header: "Framework", width: 18 },
    { key: "category", header: "Category", width: 18 },
  ];

  const rows = requirements.map((r) => ({
    controlCode: r.code,
    name: r.name,
    status: r.controlCompliance || "",
    grouping: r.requirementType || "",
    framework: r.framework?.name || "",
    category: r.category?.name || "",
  }));

  const compliant = requirements.filter((r) => r.controlCompliance === "Compliant").length;

  return {
    title: "Control Effectiveness Report",
    description: "Analysis of control implementation and effectiveness",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Controls": requirements.length,
      "Compliant": compliant,
      "Effectiveness Rate": pct(compliant, requirements.length),
    },
  };
}

// ────────────────────────────────────────────
// 3. QPost Framework Compliance
// ────────────────────────────────────────────
export async function fetchQPostFrameworkCompliance(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const frameworks = await prisma.qPostFramework.findMany({
    where: { ...tf, status: "Subscribed", isMasterTemplate: false },
    include: {
      _count: { select: { requirements: true, evidences: true } },
    },
    orderBy: { name: "asc" },
  });

  const columns: ReportColumn[] = [
    { key: "name", header: "Framework", width: 24 },
    { key: "code", header: "Code", width: 12 },
    { key: "type", header: "Type", width: 14 },
    { key: "requirements", header: "Requirements", width: 14 },
    { key: "controls", header: "Controls", width: 12 },
    { key: "compliance", header: "Compliance %", width: 14 },
    { key: "policy", header: "Policy %", width: 12 },
    { key: "evidence", header: "Evidence %", width: 12 },
  ];

  const rows = frameworks.map((f) => ({
    name: f.name,
    code: f.code || "",
    type: f.type,
    requirements: f._count.requirements,
    controls: f._count.requirements,
    compliance: `${Math.round(f.compliancePercentage)}%`,
    policy: `${Math.round(f.policyPercentage)}%`,
    evidence: `${Math.round(f.evidencePercentage)}%`,
  }));

  return {
    title: "Framework Compliance Report",
    description: "Compliance status by framework and requirements",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: { "Total Frameworks": frameworks.length },
  };
}

// ────────────────────────────────────────────
// 4. QPost Risk Assessment
// ────────────────────────────────────────────
export async function fetchQPostRiskAssessment(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const risks = await prisma.risk.findMany({
    where: tf,
    include: {
      category: { select: { name: true } },
      type: { select: { name: true } },
      department: { select: { name: true } },
      owner: { select: { fullName: true } },
    },
    orderBy: { riskScore: "desc" },
  });

  const columns: ReportColumn[] = [
    { key: "riskId", header: "Risk ID", width: 12 },
    { key: "name", header: "Name", width: 24 },
    { key: "rating", header: "Rating", width: 12 },
    { key: "score", header: "Score", width: 8 },
    { key: "likelihood", header: "Likelihood", width: 10 },
    { key: "impact", header: "Impact", width: 8 },
    { key: "status", header: "Status", width: 12 },
    { key: "category", header: "Category", width: 16 },
    { key: "department", header: "Department", width: 16 },
    { key: "owner", header: "Owner", width: 16 },
  ];

  const rows = risks.map((r) => ({
    riskId: r.riskId,
    name: r.name,
    rating: r.riskRating,
    score: r.riskScore,
    likelihood: r.likelihood,
    impact: r.impact,
    status: r.status,
    category: r.category?.name || "",
    department: r.department?.name || "",
    owner: r.owner?.fullName || "",
  }));

  return {
    title: "Risk Assessment Report",
    description: "Risk register with ratings and mitigation status",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Risks": risks.length,
      "High": risks.filter((r) => r.riskRating === "High" || r.riskRating === "Very High" || r.riskRating === "Catastrophic").length,
      "Medium": risks.filter((r) => r.riskRating === "Medium").length,
      "Low": risks.filter((r) => r.riskRating === "Low").length,
    },
  };
}

// ────────────────────────────────────────────
// 5. QPost Risk Treatment
// ────────────────────────────────────────────
export async function fetchQPostRiskTreatment(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const risks = await prisma.risk.findMany({
    where: tf,
    include: {
      owner: { select: { fullName: true } },
    },
    orderBy: { riskScore: "desc" },
  });

  const columns: ReportColumn[] = [
    { key: "riskId", header: "Risk ID", width: 12 },
    { key: "name", header: "Name", width: 24 },
    { key: "rating", header: "Rating", width: 12 },
    { key: "strategy", header: "Strategy", width: 12 },
    { key: "treatmentPlan", header: "Treatment Plan", width: 28 },
    { key: "dueDate", header: "Due Date", width: 12 },
    { key: "treatmentStatus", header: "Treatment Status", width: 14 },
    { key: "owner", header: "Owner", width: 16 },
  ];

  const rows = risks.map((r) => ({
    riskId: r.riskId,
    name: r.name,
    rating: r.riskRating,
    strategy: r.responseStrategy || "",
    treatmentPlan: r.treatmentPlan || "",
    dueDate: fmt(r.treatmentDueDate),
    treatmentStatus: r.treatmentStatus || "",
    owner: r.owner?.fullName || "",
  }));

  return {
    title: "Risk Treatment Report",
    description: "Risk treatment plans and progress tracking",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Risks": risks.length,
      "With Treatment Plan": risks.filter((r) => r.treatmentPlan).length,
      "Treatment Completed": risks.filter(
        (r) => r.treatmentStatus === "Completed"
      ).length,
    },
  };
}

// ────────────────────────────────────────────
// 6. QPost Risk Matrix
// ────────────────────────────────────────────
export async function fetchQPostRiskMatrix(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const risks = await prisma.risk.findMany({
    where: tf,
    select: {
      riskId: true,
      name: true,
      likelihood: true,
      impact: true,
      riskScore: true,
      riskRating: true,
    },
  });

  // Group by likelihood x impact
  const grid: Record<
    string,
    { likelihood: number; impact: number; score: number; count: number; risks: string[] }
  > = {};

  for (const r of risks) {
    const key = `${r.likelihood}x${r.impact}`;
    if (!grid[key]) {
      grid[key] = {
        likelihood: r.likelihood,
        impact: r.impact,
        score: r.riskScore,
        count: 0,
        risks: [],
      };
    }
    grid[key].count++;
    if (grid[key].risks.length < 5) {
      grid[key].risks.push(r.riskId);
    }
  }

  const columns: ReportColumn[] = [
    { key: "likelihood", header: "Likelihood", width: 12 },
    { key: "impact", header: "Impact", width: 10 },
    { key: "score", header: "Risk Score", width: 12 },
    { key: "count", header: "Count", width: 8 },
    { key: "risks", header: "Risk IDs", width: 36 },
  ];

  const rows = Object.values(grid)
    .sort((a, b) => b.score - a.score)
    .map((g) => ({
      likelihood: g.likelihood,
      impact: g.impact,
      score: g.score,
      count: g.count,
      risks: g.risks.join(", ") + (g.count > 5 ? ` (+${g.count - 5} more)` : ""),
    }));

  return {
    title: "Risk Matrix Report",
    description: "Risk matrix with heat map analysis",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Risks": risks.length,
      "Unique Cells": Object.keys(grid).length,
    },
  };
}

// ────────────────────────────────────────────
// 7. QPost Evidence Collection
// ────────────────────────────────────────────
export async function fetchQPostEvidenceCollection(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const evidences = await prisma.qPostEvidence.findMany({
    where: tf,
    include: {
      framework: { select: { name: true } },
      department: { select: { name: true } },
      assignee: { select: { fullName: true } },
    },
    orderBy: { evidenceCode: "asc" },
  });

  const columns: ReportColumn[] = [
    { key: "evidenceCode", header: "Evidence Code", width: 14 },
    { key: "name", header: "Name", width: 24 },
    { key: "status", header: "Status", width: 14 },
    { key: "domain", header: "Domain", width: 16 },
    { key: "framework", header: "Framework", width: 18 },
    { key: "department", header: "Department", width: 16 },
    { key: "assignee", header: "Assignee", width: 16 },
    { key: "dueDate", header: "Due Date", width: 12 },
  ];

  const rows = evidences.map((e) => ({
    evidenceCode: e.evidenceCode,
    name: e.name,
    status: e.status,
    domain: e.domain || "",
    framework: e.framework?.name || "",
    department: e.department?.name || "",
    assignee: e.assignee?.fullName || "",
    dueDate: fmt(e.dueDate),
  }));

  const uploaded = evidences.filter(
    (e) => e.status !== "Not Uploaded"
  ).length;

  return {
    title: "Evidence Collection Report",
    description: "Status of evidence collection and gaps",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Evidence Items": evidences.length,
      "Collected": uploaded,
      "Not Uploaded": evidences.length - uploaded,
      "Collection Rate": pct(uploaded, evidences.length),
    },
  };
}

// ────────────────────────────────────────────
// 8. QPost Evidence Review
// ────────────────────────────────────────────
export async function fetchQPostEvidenceReview(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const evidences = await prisma.qPostEvidence.findMany({
    where: tf,
    include: {
      assignee: { select: { fullName: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const columns: ReportColumn[] = [
    { key: "evidenceCode", header: "Evidence Code", width: 14 },
    { key: "name", header: "Name", width: 26 },
    { key: "status", header: "Status", width: 14 },
    { key: "reviewDate", header: "Review Date", width: 12 },
    { key: "publishedAt", header: "Published Date", width: 14 },
    { key: "recurrence", header: "Recurrence", width: 12 },
    { key: "assignee", header: "Assignee", width: 16 },
  ];

  const rows = evidences.map((e) => ({
    evidenceCode: e.evidenceCode,
    name: e.name,
    status: e.status,
    reviewDate: fmt(e.reviewDate),
    publishedAt: fmt(e.publishedAt),
    recurrence: e.recurrence || "",
    assignee: e.assignee?.fullName || "",
  }));

  return {
    title: "Evidence Review Report",
    description: "Evidence review status and pending items",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total": evidences.length,
      "Published": evidences.filter((e) => e.status === "Published").length,
      "Validated": evidences.filter((e) => e.status === "Validated").length,
      "Pending Review": evidences.filter(
        (e) => e.status === "Draft" || e.status === "Need Attention"
      ).length,
    },
  };
}

// ────────────────────────────────────────────
// 9. QPost Exception Report
// ────────────────────────────────────────────
export async function fetchQPostExceptionReport(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const exceptions = await prisma.qPostException.findMany({
    where: tf,
    include: {
      requirement: { select: { name: true } },
      department: { select: { name: true } },
      requester: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const columns: ReportColumn[] = [
    { key: "exceptionCode", header: "Exception Code", width: 14 },
    { key: "name", header: "Name", width: 22 },
    { key: "status", header: "Status", width: 12 },
    { key: "relatedEntity", header: "Related Entity", width: 22 },
    { key: "department", header: "Department", width: 16 },
    { key: "requester", header: "Requester", width: 16 },
    { key: "startDate", header: "Start Date", width: 12 },
    { key: "endDate", header: "End Date", width: 12 },
  ];

  const rows = exceptions.map((e) => ({
    exceptionCode: e.exceptionCode,
    name: e.name,
    status: e.status,
    relatedEntity: e.requirement?.name || "",
    department: e.department?.name || "",
    requester: e.requester?.fullName || "",
    startDate: fmt(e.startDate),
    endDate: fmt(e.endDate),
  }));

  return {
    title: "Exception Report",
    description: "All exceptions and their justifications",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Exceptions": exceptions.length,
      "Pending": exceptions.filter((e) => e.status === "Pending").length,
      "Approved": exceptions.filter((e) => e.status === "Approved").length,
      "Closed": exceptions.filter((e) => e.status === "Closed").length,
    },
  };
}

// ────────────────────────────────────────────
// 10. QPost Policy Report
// ────────────────────────────────────────────
export async function fetchQPostPolicyReport(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const policies = await prisma.qPostPolicy.findMany({
    where: tf,
    include: {
      department: { select: { name: true } },
      assignee: { select: { fullName: true } },
    },
    orderBy: { code: "asc" },
  });

  const columns: ReportColumn[] = [
    { key: "code", header: "Code", width: 12 },
    { key: "name", header: "Name", width: 26 },
    { key: "type", header: "Type", width: 12 },
    { key: "status", header: "Status", width: 14 },
    { key: "version", header: "Version", width: 8 },
    { key: "department", header: "Department", width: 16 },
    { key: "assignee", header: "Assignee", width: 16 },
    { key: "effectiveDate", header: "Effective Date", width: 12 },
    { key: "reviewDate", header: "Review Date", width: 12 },
  ];

  const rows = policies.map((p) => ({
    code: p.code,
    name: p.name,
    type: p.documentType,
    status: p.status,
    version: p.version,
    department: p.department?.name || "",
    assignee: p.assignee?.fullName || "",
    effectiveDate: fmt(p.effectiveDate),
    reviewDate: fmt(p.reviewDate),
  }));

  return {
    title: "Policy Compliance Report",
    description: "Policy status and compliance tracking",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total Policies": policies.length,
      "Published": policies.filter((p) => p.status === "Published").length,
      "Approved": policies.filter((p) => p.status === "Approved").length,
      "Draft": policies.filter((p) => p.status === "Draft").length,
    },
  };
}

// ────────────────────────────────────────────
// 11. QPost KPI Performance
// ────────────────────────────────────────────
export async function fetchQPostKPIPerformance(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const kpis = await prisma.qPostKPI.findMany({
    where: tf,
    include: {
      evidence: { select: { evidenceCode: true, name: true } },
      department: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });

  const columns: ReportColumn[] = [
    { key: "code", header: "KPI Code", width: 12 },
    { key: "objective", header: "Objective", width: 28 },
    { key: "expected", header: "Expected", width: 10 },
    { key: "actual", header: "Actual", width: 10 },
    { key: "status", header: "Status", width: 12 },
    { key: "department", header: "Department", width: 16 },
    { key: "evidence", header: "Evidence", width: 18 },
    { key: "reviewDate", header: "Review Date", width: 12 },
  ];

  const rows = kpis.map((k) => ({
    code: k.code,
    objective: k.objective || "",
    expected: k.expectedScore ?? "",
    actual: k.actualScore ?? "",
    status: k.status,
    department: k.department?.name || "",
    evidence: k.evidence
      ? `${k.evidence.evidenceCode} - ${k.evidence.name}`
      : "",
    reviewDate: fmt(k.reviewDate),
  }));

  const achieved = kpis.filter((k) => k.status === "Achieved").length;

  return {
    title: "KPI Performance Report",
    description: "Key performance indicators and trends",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total KPIs": kpis.length,
      "Achieved": achieved,
      "Missed": kpis.filter((k) => k.status === "Missed").length,
      "Achievement Rate": pct(achieved, kpis.length),
    },
  };
}

// ────────────────────────────────────────────
// 12. QPost KPI Dashboard
// ────────────────────────────────────────────
export async function fetchQPostKPIDashboard(
  session: Session
): Promise<ReportData> {
  const tf = getTenantFilter(session);

  const kpis = await prisma.qPostKPI.findMany({
    where: tf,
    include: { department: { select: { name: true } } },
  });

  // Summary metrics
  const total = kpis.length;
  const achieved = kpis.filter((k) => k.status === "Achieved").length;
  const missed = kpis.filter((k) => k.status === "Missed").length;
  const overdue = kpis.filter((k) => k.status === "Overdue").length;
  const scheduled = kpis.filter((k) => k.status === "Scheduled").length;

  // Department breakdown
  const byDept: Record<
    string,
    { total: number; achieved: number; missed: number; overdue: number }
  > = {};
  for (const k of kpis) {
    const dept = k.department?.name || "Unassigned";
    if (!byDept[dept])
      byDept[dept] = { total: 0, achieved: 0, missed: 0, overdue: 0 };
    byDept[dept].total++;
    if (k.status === "Achieved") byDept[dept].achieved++;
    if (k.status === "Missed") byDept[dept].missed++;
    if (k.status === "Overdue") byDept[dept].overdue++;
  }

  const columns: ReportColumn[] = [
    { key: "metric", header: "Metric / Department", width: 24 },
    { key: "total", header: "Total", width: 10 },
    { key: "achieved", header: "Achieved", width: 10 },
    { key: "missed", header: "Missed", width: 10 },
    { key: "overdue", header: "Overdue", width: 10 },
    { key: "rate", header: "Achievement %", width: 14 },
  ];

  // First row: overall summary
  const rows: Record<string, string | number>[] = [
    {
      metric: "Overall",
      total,
      achieved,
      missed,
      overdue,
      rate: pct(achieved, total),
    },
  ];

  // Then per-department
  for (const [dept, v] of Object.entries(byDept).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    rows.push({
      metric: dept,
      total: v.total,
      achieved: v.achieved,
      missed: v.missed,
      overdue: v.overdue,
      rate: pct(v.achieved, v.total),
    });
  }

  return {
    title: "KPI Dashboard Report",
    description: "Executive KPI dashboard with metrics",
    generatedAt: new Date().toLocaleString(),
    customerName: session.customerAccountName || "N/A",
    columns,
    rows,
    summary: {
      "Total KPIs": total,
      "Achieved": achieved,
      "Missed": missed,
      "Overdue": overdue,
      "Scheduled": scheduled,
    },
  };
}

// ────────────────────────────────────────────
// Dispatcher
// ────────────────────────────────────────────
const qpostFetchers: Record<string, (s: Session) => Promise<ReportData>> = {
  "compliance-summary": fetchQPostComplianceSummary,
  "control-effectiveness": fetchQPostControlEffectiveness,
  "framework-compliance": fetchQPostFrameworkCompliance,
  "risk-assessment": fetchQPostRiskAssessment,
  "risk-treatment": fetchQPostRiskTreatment,
  "risk-matrix": fetchQPostRiskMatrix,
  "evidence-collection": fetchQPostEvidenceCollection,
  "evidence-review": fetchQPostEvidenceReview,
  "exception-report": fetchQPostExceptionReport,
  "policy-report": fetchQPostPolicyReport,
  "kpi-performance": fetchQPostKPIPerformance,
  "kpi-dashboard": fetchQPostKPIDashboard,
};

export function getQPostReportFetcher(
  reportType: string
): ((s: Session) => Promise<ReportData>) | undefined {
  return qpostFetchers[reportType];
}
