"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/shared";
import { DonutChart, HorizontalBarChart, StackedBarChart } from "@/components/charts";

interface DashboardData {
  dashboardStats: {
    departments: number;
    stakeholders: number;
    regulations: number;
    issues: number;
    risks: number;
    exceptions: number;
  };
  complianceData: { framework: string; compliant: number; nonCompliant: number }[];
  riskAssessmentData: { category: string; total: number; closed: number }[];
  issueByCategoryData: { name: string; value: number; color: string }[];
  issueByDepartmentData: { name: string; value: number; color: string }[];
  issueByDomainData: { name: string; value: number; color: string }[];
  exceptionByTypeData: { name: string; value: number; color: string }[];
  evidenceKPIData: { department: string; overdue: number; achieved: number; missed: number; scheduled: number }[];
  processKPIData: { department: string; overdue: number; achieved: number; missed: number; scheduled: number }[];
  governanceStatusData: { type: string; notUploaded: number; draft: number; approved: number; needsReview: number; published: number }[];
  exceptionStatusData: { type: string; pending: number; approved: number; authorized: number; closed: number; overdue: number }[];
}

const defaultDashboardData: DashboardData = {
  dashboardStats: { departments: 0, stakeholders: 0, regulations: 0, issues: 0, risks: 0, exceptions: 0 },
  complianceData: [],
  riskAssessmentData: [],
  issueByCategoryData: [],
  issueByDepartmentData: [],
  issueByDomainData: [],
  exceptionByTypeData: [],
  evidenceKPIData: [],
  processKPIData: [],
  governanceStatusData: [],
  exceptionStatusData: [],
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(defaultDashboardData);
  const [loading, setLoading] = useState(true);

  // Redirect users based on their role to appropriate landing pages
  useEffect(() => {
    if (session?.user?.roles?.includes("GRCAdministrator")) {
      router.replace("/grc");
    } else if (session?.user?.roles?.includes("AuditHead")) {
      router.replace("/internal-audit/dashboard");
    } else if (session?.user?.roles?.includes("Auditee") &&
               !session?.user?.roles?.includes("AuditHead") &&
               !session?.user?.roles?.includes("Auditor")) {
      // Auditee can only access Fieldwork, CAPA Tracking, and Reports (NO Dashboard)
      router.replace("/internal-audit/fieldwork");
    }
  }, [session, router]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const {
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
  } = data;

  // Calculate issue totals
  const issueCategoryTotal = issueByCategoryData.reduce((sum, item) => sum + item.value, 0);
  const issueDepartmentTotal = issueByDepartmentData.reduce((sum, item) => sum + item.value, 0);
  const issueDomainTotal = issueByDomainData.reduce((sum, item) => sum + item.value, 0);
  const exceptionTotal = exceptionByTypeData.reduce((sum, item) => sum + item.value, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-grc-text">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard
          label="Departments"
          value={dashboardStats.departments}
          href="/organization/profile?tab=departments"
        />
        <StatsCard
          label="Stakeholders"
          value={dashboardStats.stakeholders}
          href="/organization/context"
        />
        <StatsCard
          label="Regulations"
          value={dashboardStats.regulations}
          href="/organization/profile?tab=regulations"
        />
        <StatsCard
          label="Issues"
          value={dashboardStats.issues}
          href="/organization/context"
        />
        <StatsCard
          label="Risks"
          value={dashboardStats.risks}
          href="/risks/register"
        />
        <StatsCard
          label="Exceptions"
          value={dashboardStats.exceptions}
          href="/compliance/exception"
        />
      </div>

      {/* Charts Row 1: Compliance & Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarChart
          title="Overall Compliance Status"
          data={complianceData}
          yAxisDataKey="framework"
          bars={[
            { dataKey: "compliant", fill: "#22C55E", name: "Compliant" },
            { dataKey: "nonCompliant", fill: "#EF4444", name: "Non Compliant" },
          ]}
        />
        <HorizontalBarChart
          title="Risk Assessment Overview"
          data={riskAssessmentData}
          yAxisDataKey="category"
          bars={[
            { dataKey: "total", fill: "#146FF4", name: "Total" },
            { dataKey: "closed", fill: "#22C55E", name: "Closed" },
          ]}
        />
      </div>

      {/* Charts Row 2: Issues */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DonutChart
          title="Issue By Category"
          data={issueByCategoryData}
          centerLabel={issueCategoryTotal}
        />
        <DonutChart
          title="Issue By Department"
          data={issueByDepartmentData}
          centerLabel={issueDepartmentTotal}
        />
        <DonutChart
          title="Issue By Domain"
          data={issueByDomainData}
          centerLabel={issueDomainTotal}
        />
        <DonutChart
          title="Exception"
          data={exceptionByTypeData}
          centerLabel={exceptionTotal}
        />
      </div>

      {/* Charts Row 3: KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarChart
          title="Evidence KPI"
          data={evidenceKPIData}
          yAxisDataKey="department"
          bars={[
            { dataKey: "overdue", fill: "#EF4444", name: "Overdue" },
            { dataKey: "achieved", fill: "#22C55E", name: "Achieved" },
            { dataKey: "missed", fill: "#F59E0B", name: "Missed" },
            { dataKey: "scheduled", fill: "#146FF4", name: "Scheduled" },
          ]}
        />
        <StackedBarChart
          title="Process KPI"
          data={processKPIData}
          yAxisDataKey="department"
          bars={[
            { dataKey: "overdue", fill: "#EF4444", name: "Overdue" },
            { dataKey: "achieved", fill: "#22C55E", name: "Achieved" },
            { dataKey: "missed", fill: "#F59E0B", name: "Missed" },
            { dataKey: "scheduled", fill: "#146FF4", name: "Scheduled" },
          ]}
        />
      </div>

      {/* Charts Row 4: Governance & Exceptions Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarChart
          title="Governance Status"
          data={governanceStatusData}
          yAxisDataKey="type"
          bars={[
            { dataKey: "notUploaded", fill: "#6C717E", name: "Not Uploaded" },
            { dataKey: "draft", fill: "#F59E0B", name: "Draft" },
            { dataKey: "approved", fill: "#22C55E", name: "Approved" },
            { dataKey: "needsReview", fill: "#EF4444", name: "Needs Review" },
            { dataKey: "published", fill: "#146FF4", name: "Published" },
          ]}
          layout="horizontal"
        />
        <HorizontalBarChart
          title="Exceptions Status"
          data={exceptionStatusData}
          yAxisDataKey="type"
          bars={[
            { dataKey: "pending", fill: "#F59E0B", name: "Pending" },
            { dataKey: "approved", fill: "#22C55E", name: "Approved" },
            { dataKey: "authorized", fill: "#146FF4", name: "Authorized" },
            { dataKey: "closed", fill: "#6C717E", name: "Closed" },
            { dataKey: "overdue", fill: "#EF4444", name: "Overdue" },
          ]}
        />
      </div>
    </div>
  );
}
