"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { StatsCard } from "@/components/shared";
import { DonutChart, HorizontalBarChart, StackedBarChart, ComplianceProgressBar, DocumentStatusCard } from "@/components/charts";
import {
  Building2,
  Users,
  Scale,
  AlertTriangle,
  ShieldAlert,
  FileWarning,
} from "lucide-react";

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
    } else if (session?.user?.roles?.includes("AuditHead") || session?.user?.roles?.includes("AuditManager")) {
      router.replace("/internal-audit/dashboard");
    } else if (session?.user?.roles?.includes("Auditee") &&
               !session?.user?.roles?.includes("AuditHead") &&
               !session?.user?.roles?.includes("AuditManager") &&
               !session?.user?.roles?.includes("Auditor")) {
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

  // Calculate totals
  const issueCategoryTotal = issueByCategoryData.reduce((sum, item) => sum + item.value, 0);
  const issueDepartmentTotal = issueByDepartmentData.reduce((sum, item) => sum + item.value, 0);
  const issueDomainTotal = issueByDomainData.reduce((sum, item) => sum + item.value, 0);
  const exceptionTotal = exceptionByTypeData.reduce((sum, item) => sum + item.value, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
        
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard
          label="Departments"
          value={dashboardStats.departments}
          href="/organization/profile?tab=departments"
          icon={Building2}
        />
        <StatsCard
          label="Stakeholders"
          value={dashboardStats.stakeholders}
          href="/organization/context"
          icon={Users}
        />
        <StatsCard
          label="Regulations"
          value={dashboardStats.regulations}
          href="/organization/profile?tab=regulations"
          icon={Scale}
        />
        <StatsCard
          label="Issues"
          value={dashboardStats.issues}
          href="/organization/context"
          icon={AlertTriangle}
        />
        <StatsCard
          label="Risks"
          value={dashboardStats.risks}
          href="/risks/register"
          icon={ShieldAlert}
        />
        <StatsCard
          label="Exceptions"
          value={dashboardStats.exceptions}
          href="/compliance/exception"
          icon={FileWarning}
        />
      </div>

      {/* Compliance & Risk Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComplianceProgressBar
          title="Overall Compliance Status"
          data={complianceData}
        />
        <HorizontalBarChart
          title="Risk Assessment Overview"
          data={riskAssessmentData}
          yAxisDataKey="category"
          bars={[
            { dataKey: "closed", fill: "#10B981", name: "Closed" },
            { dataKey: "total", fill: "#6366F1", name: "Total" },
          ]}
        />
      </div>

      {/* Issues & Exceptions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DonutChart
          title="Issue By Category"
          data={issueByCategoryData}
          centerLabel={issueCategoryTotal}
          centerSubLabel="Total"
        />
        <DonutChart
          title="Issue By Department"
          data={issueByDepartmentData}
          centerLabel={issueDepartmentTotal}
          centerSubLabel="Total"
        />
        <DonutChart
          title="Issue By Domain"
          data={issueByDomainData}
          centerLabel={issueDomainTotal}
          centerSubLabel="Total"
        />
        <DonutChart
          title="Exceptions"
          data={exceptionByTypeData}
          centerLabel={exceptionTotal}
          centerSubLabel="Total"
        />
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarChart
          title="Evidence KPI"
          data={evidenceKPIData}
          yAxisDataKey="department"
          bars={[
            { dataKey: "achieved", fill: "#10B981", name: "Achieved" },
            { dataKey: "scheduled", fill: "#6366F1", name: "Scheduled" },
            { dataKey: "missed", fill: "#F59E0B", name: "Missed" },
            { dataKey: "overdue", fill: "#EF4444", name: "Overdue" },
          ]}
        />
        <StackedBarChart
          title="Process KPI"
          data={processKPIData}
          yAxisDataKey="department"
          bars={[
            { dataKey: "achieved", fill: "#10B981", name: "Achieved" },
            { dataKey: "scheduled", fill: "#6366F1", name: "Scheduled" },
            { dataKey: "missed", fill: "#F59E0B", name: "Missed" },
            { dataKey: "overdue", fill: "#EF4444", name: "Overdue" },
          ]}
        />
      </div>

      {/* Governance & Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarChart
          title="Document Status"
          data={governanceStatusData}
          yAxisDataKey="type"
          bars={[
            { dataKey: "published", fill: "#6366F1", name: "Published" },
            { dataKey: "approved", fill: "#10B981", name: "Approved" },
            { dataKey: "draft", fill: "#F59E0B", name: "Draft" },
            { dataKey: "needsReview", fill: "#EF4444", name: "Needs Review" },
            { dataKey: "notUploaded", fill: "#94A3B8", name: "Not Uploaded" },
          ]}
          layout="horizontal"
        />
        <HorizontalBarChart
          title="Exception Status"
          data={exceptionStatusData}
          yAxisDataKey="type"
          bars={[
            { dataKey: "approved", fill: "#10B981", name: "Approved" },
            { dataKey: "authorized", fill: "#6366F1", name: "Authorized" },
            { dataKey: "pending", fill: "#F59E0B", name: "Pending" },
            { dataKey: "closed", fill: "#94A3B8", name: "Closed" },
            { dataKey: "overdue", fill: "#EF4444", name: "Overdue" },
          ]}
        />
      </div>
    </div>
  );
}
