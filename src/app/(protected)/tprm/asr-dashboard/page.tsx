"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { Loader2, Home, ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Assessment {
  id: string;
  status: string;
  assessmentType: string;
  vendorRiskRating?: string;
  inherentRisk?: string;
  assessmentResult?: string;
  vendor?: { name: string; vrr?: string; vendorRiskRating?: string };
}

interface IssueEntry {
  id: string;
  status: string;
  severity?: string;
  domainName?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Open: "#dc2626",
  Overdue: "#f97316",
  Closed: "#16a34a",
};

const PROGRESS_COLORS: Record<string, string> = {
  Initiated: "#eab308",
  "In Progress": "#a78bfa",
  Completed: "#14b8a6",
};

const RISK_COLORS: Record<string, string> = {
  High: "#f97316",
  Medium: "#eab308",
  Low: "#16a34a",
};

const RESULT_COLORS: Record<string, string> = {
  Satisfactory: "#16a34a",
  Unsatisfactory: "#f97316",
  Deficient: "#a78bfa",
};

const DOMAIN_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function AsrDashboardPage() {
  const { t } = useLanguage();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [issues, setIssues] = useState<IssueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic data translation
  const { data: translatedAssessments } = useTranslatedData(assessments, { modelName: 'TPRMAssessment' });
  const { data: translatedIssues } = useTranslatedData(issues, { modelName: 'TPRMIssueRemediation' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [aRes, iRes] = await Promise.all([
        fetch("/api/tprm/assessments?limit=500"),
        fetch("/api/tprm/asr-issues?tab=flat&limit=500"),
      ]);
      if (aRes.ok) {
        const aJson = await aRes.json();
        setAssessments(aJson.data || []);
      }
      if (iRes.ok) {
        const iJson = await iRes.json();
        setIssues(iJson.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Issue Status chart data
  // DB statuses: Pending, Submitted, Assigned to BO, Assigned to IT, Closed, Overdue
  // Dashboard buckets: Open (all active), Overdue, Closed
  const issueStatusData = useMemo(() => {
    const counts: Record<string, number> = { Open: 0, Overdue: 0, Closed: 0 };
    translatedIssues.forEach((i) => {
      const s = i.status || "Pending";
      if (s === "Closed") counts.Closed++;
      else if (s === "Overdue") counts.Overdue++;
      else counts.Open++; // Pending, Submitted, Assigned to BO, Assigned to IT
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [translatedIssues]);

  // Assessment Progress chart data
  const progressData = useMemo(() => {
    const counts: Record<string, number> = { Initiated: 0, "In Progress": 0, Completed: 0 };
    translatedAssessments.forEach((a) => {
      if (a.status === "Draft") counts.Initiated++;
      else if (["In Progress", "Submitted", "Under Review"].includes(a.status)) counts["In Progress"]++;
      else if (["Completed", "Approved"].includes(a.status)) counts.Completed++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [translatedAssessments]);

  // Inherent Risk pie chart
  // VRR values: Nominal, Low, Moderate, High, Critical → map to High/Medium/Low
  const riskData = useMemo(() => {
    const VRR_TO_RISK: Record<string, string> = {
      Critical: "High", High: "High",
      Moderate: "Medium", Medium: "Medium",
      Low: "Low", Nominal: "Low",
    };
    const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    translatedAssessments.forEach((a) => {
      const raw = a.inherentRisk || a.vendor?.vrr || a.vendor?.vendorRiskRating || "Medium";
      const risk = VRR_TO_RISK[raw] || "Medium";
      counts[risk]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [translatedAssessments]);

  // Assessment Result pie chart — only count assessments that have a result
  const resultData = useMemo(() => {
    const counts: Record<string, number> = { Satisfactory: 0, Unsatisfactory: 0, Deficient: 0 };
    translatedAssessments.forEach((a) => {
      const result = a.assessmentResult;
      if (result && counts[result] !== undefined) counts[result]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [translatedAssessments]);

  // Top 5 Vendors by severity
  const vendorData = useMemo(() => {
    const VRR_TO_SEV: Record<string, "High" | "Medium" | "Low"> = {
      Critical: "High", High: "High",
      Moderate: "Medium", Medium: "Medium",
      Low: "Low", Nominal: "Low",
    };
    const vendorMap: Record<string, { High: number; Medium: number; Low: number }> = {};
    translatedAssessments.forEach((a) => {
      const vName = a.vendor?.name || t("Unknown");
      if (!vendorMap[vName]) vendorMap[vName] = { High: 0, Medium: 0, Low: 0 };
      const raw = a.inherentRisk || a.vendor?.vrr || a.vendor?.vendorRiskRating || "Medium";
      const sev = VRR_TO_SEV[raw] || "Medium";
      vendorMap[vName][sev]++;
    });
    return Object.entries(vendorMap)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => (b.High + b.Medium + b.Low) - (a.High + a.Medium + a.Low))
      .slice(0, 5);
  }, [translatedAssessments]);

  // Domain distribution from issues — strip "CUST." prefix for cleaner labels
  const domainData = useMemo(() => {
    const counts: Record<string, number> = {};
    translatedIssues.forEach((i) => {
      let domain = i.domainName || "Unspecified";
      domain = domain.replace(/^CUST\./i, "");
      counts[domain] = (counts[domain] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [translatedIssues]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment Dashboard")}</span>
      </nav>

      <h1 className="text-2xl font-bold">{t("Assessment Dashboard")}</h1>

      {/* Row 1: Issue Status + Assessment Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issue Status */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Issue Status")}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={issueStatusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tickFormatter={(v) => t(v)} />
              <YAxis />
              <Tooltip formatter={(value) => [value as number, t("Count")]} labelFormatter={(label) => t(label)} />
              <Bar dataKey="value" name={t("Count")}>
                {issueStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Assessment Progress */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Assessment Progress")}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tickFormatter={(v) => t(v)} />
              <YAxis />
              <Tooltip formatter={(value) => [value as number, t("Count")]} labelFormatter={(label) => t(label)} />
              <Bar dataKey="value" name={t("Count")}>
                {progressData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PROGRESS_COLORS[entry.name] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Inherent Risk + Assessment Result */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inherent Risk */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Inherent Risk")}</h3>
          {riskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ value }) => `${value}`}
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.name] || "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip formatter={((value: number, name: string) => [value, t(name)]) as never} />
                <Legend formatter={(value: string) => t(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              {t("No Data to Display")}
            </div>
          )}
        </div>

        {/* Assessment Result */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Assessment Result")}</h3>
          {resultData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={resultData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ value }) => `${value}`}
                >
                  {resultData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={RESULT_COLORS[entry.name] || "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip formatter={((value: number, name: string) => [value, t(name)]) as never} />
                <Legend formatter={(value: string) => t(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              {t("No Data to Display")}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Top 5 Vendors + Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Vendors */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Vendors")}</h3>
          {vendorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vendorData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="High" stackId="a" fill="#dc2626" name={t("High Severity")} />
                <Bar dataKey="Medium" stackId="a" fill="#f97316" name={t("Medium Severity")} />
                <Bar dataKey="Low" stackId="a" fill="#16a34a" name={t("Low Severity")} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              {t("No Data to Display")}
            </div>
          )}
        </div>

        {/* Domains */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Domains")}</h3>
          {domainData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, domainData.length * 36)}>
              <BarChart data={domainData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 12 }} tickFormatter={(v) => t(v)} />
                <Tooltip formatter={(value) => [value as number, t("Issues")]} labelFormatter={(label) => t(label)} />
                <Bar dataKey="value" name={t("Issues")} radius={[0, 4, 4, 0]}>
                  {domainData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={DOMAIN_COLORS[index % DOMAIN_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              {t("No Data to Display")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
