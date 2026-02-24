"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { StatsCard } from "@/components/shared";
import { DonutChart, HorizontalBarChart, StackedBarChart, ComplianceProgressBar, DocumentStatusCard } from "@/components/charts";
import {
  Building2,
  Users,
  Scale,
  AlertTriangle,
  ShieldAlert,
  FileWarning,
  ChevronRight,
  Home,
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
  complianceData: { frameworkId: string; framework: string; compliant: number; nonCompliant: number }[];
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
  const { t } = useLanguage();
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
          <p className="text-sm text-slate-500 font-medium">{t("Loading dashboard...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Dashboard")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Dashboard Overview")}</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatsCard
          label={t("Departments")}
          value={dashboardStats.departments}
          href="/organization/profile?tab=departments&from=dashboard"
          icon={Building2}
        />
        <StatsCard
          label={t("Stakeholders")}
          value={dashboardStats.stakeholders}
          href="/organization/context?from=dashboard"
          icon={Users}
        />
        <StatsCard
          label={t("Regulations")}
          value={dashboardStats.regulations}
          href="/organization/profile?tab=regulations&from=dashboard"
          icon={Scale}
        />
        <StatsCard
          label={t("Issues")}
          value={dashboardStats.issues}
          href="/organization/context?tab=issuelist&from=dashboard"
          icon={AlertTriangle}
        />
        <StatsCard
          label={t("Risks")}
          value={dashboardStats.risks}
          href="/risks/register?from=dashboard"
          icon={ShieldAlert}
        />
        <StatsCard
          label={t("Exceptions")}
          value={dashboardStats.exceptions}
          href="/compliance/exceptions?from=dashboard"
          icon={FileWarning}
        />
      </div>

      {/* Compliance & Risk Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <ComplianceProgressBar
          title={t("Overall Compliance Status")}
          data={complianceData}
          onFrameworkClick={(frameworkId) => {
            router.push(`/compliance/control?frameworkId=${frameworkId}&from=dashboard`);
          }}
        />
        <HorizontalBarChart
          title={t("Risk Assessment Overview")}
          data={riskAssessmentData.map(item => ({ ...item, category: t(item.category) }))}
          yAxisDataKey="category"
          bars={[
            { dataKey: "closed", fill: "#10B981", name: t("Closed") },
            { dataKey: "total", fill: "#6366F1", name: t("Total") },
          ]}
          onClick={() => router.push("/risks/assessment?from=dashboard")}
        />
      </div>

      {/* Issues & Exceptions Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <DonutChart
          title={t("Issue By Category")}
          data={issueByCategoryData.map(item => ({ ...item, name: t(item.name) }))}
          centerLabel={issueCategoryTotal}
          centerSubLabel={t("Total")}
          onClick={() => router.push("/organization/context?tab=issuelist&from=dashboard")}
        />
        <DonutChart
          title={t("Issue By Department")}
          data={issueByDepartmentData.map(item => ({ ...item, name: t(item.name) }))}
          centerLabel={issueDepartmentTotal}
          centerSubLabel={t("Total")}
          onClick={() => router.push("/organization/context?tab=issuelist&from=dashboard")}
        />
        <DonutChart
          title={t("Issue By Domain")}
          data={issueByDomainData.map(item => ({ ...item, name: t(item.name) }))}
          centerLabel={issueDomainTotal}
          centerSubLabel={t("Total")}
          onClick={() => router.push("/organization/context?tab=issuelist&from=dashboard")}
        />
        <DonutChart
          title={t("Exceptions")}
          data={exceptionByTypeData.map(item => ({ ...item, name: t(item.name) }))}
          centerLabel={exceptionTotal}
          centerSubLabel={t("Total")}
          onClick={() => router.push("/compliance/exceptions?from=dashboard")}
        />
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <StackedBarChart
          title={t("Evidence KPI")}
          data={evidenceKPIData}
          yAxisDataKey="department"
          bars={[
            { dataKey: "achieved", fill: "#10B981", name: t("Achieved") },
            { dataKey: "scheduled", fill: "#6366F1", name: t("Scheduled") },
            { dataKey: "missed", fill: "#F59E0B", name: t("Missed") },
            { dataKey: "overdue", fill: "#EF4444", name: t("Overdue") },
          ]}
          onClick={() => router.push("/compliance/kpis?from=dashboard")}
        />
        <StackedBarChart
          title={t("Process KPI")}
          data={processKPIData}
          yAxisDataKey="department"
          bars={[
            { dataKey: "achieved", fill: "#10B981", name: t("Achieved") },
            { dataKey: "scheduled", fill: "#6366F1", name: t("Scheduled") },
            { dataKey: "missed", fill: "#F59E0B", name: t("Missed") },
            { dataKey: "overdue", fill: "#EF4444", name: t("Overdue") },
          ]}
          onClick={() => router.push("/compliance/kpis?from=dashboard")}
        />
      </div>

      {/* Governance & Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <StackedBarChart
          title={t("Governance Status")}
          data={governanceStatusData.map(item => ({ ...item, type: t(item.type) }))}
          yAxisDataKey="type"
          bars={[
            { dataKey: "notUploaded", fill: "#EF4444", name: t("Not Uploaded") },
            { dataKey: "draft", fill: "#F59E0B", name: t("Draft") },
            { dataKey: "approved", fill: "#3B82F6", name: t("Approved") },
            { dataKey: "needsReview", fill: "#1E3A5F", name: t("Needs Review") },
            { dataKey: "published", fill: "#22C55E", name: t("Published") },
          ]}
          layout="horizontal"
          onClick={() => router.push("/compliance/governance?from=dashboard")}
        />
        <HorizontalBarChart
          title={t("Exception Status")}
          data={exceptionStatusData.map(item => ({ ...item, type: t(item.type) }))}
          yAxisDataKey="type"
          bars={[
            { dataKey: "approved", fill: "#10B981", name: t("Approved") },
            { dataKey: "authorized", fill: "#6366F1", name: t("Authorized") },
            { dataKey: "pending", fill: "#F59E0B", name: t("Pending") },
            { dataKey: "closed", fill: "#94A3B8", name: t("Closed") },
            { dataKey: "overdue", fill: "#EF4444", name: t("Overdue") },
          ]}
          onClick={() => router.push("/compliance/exceptions?from=dashboard")}
        />
      </div>
    </div>
  );
}
