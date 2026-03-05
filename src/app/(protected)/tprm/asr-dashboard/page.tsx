"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  vendor?: { name: string; vendorRiskRating?: string };
}

interface IssueEntry {
  id: string;
  status: string;
  severity?: string;
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

export default function AsrDashboardPage() {
  const { t } = useLanguage();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [issues, setIssues] = useState<IssueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [aRes, iRes] = await Promise.all([
        fetch("/api/tprm/assessments?limit=500"),
        fetch("/api/tprm/asr-issues?limit=500"),
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
  const issueStatusData = useMemo(() => {
    const counts: Record<string, number> = { Open: 0, Overdue: 0, Closed: 0 };
    issues.forEach((i) => {
      if (counts[i.status] !== undefined) counts[i.status]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [issues]);

  // Assessment Progress chart data
  const progressData = useMemo(() => {
    const counts: Record<string, number> = { Initiated: 0, "In Progress": 0, Completed: 0 };
    assessments.forEach((a) => {
      if (a.status === "Draft") counts.Initiated++;
      else if (["In Progress", "Submitted", "Under Review"].includes(a.status)) counts["In Progress"]++;
      else if (["Completed", "Approved"].includes(a.status)) counts.Completed++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [assessments]);

  // Inherent Risk pie chart
  const riskData = useMemo(() => {
    const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    assessments.forEach((a) => {
      const risk = a.inherentRisk || a.vendor?.vendorRiskRating || "Medium";
      if (counts[risk] !== undefined) counts[risk]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [assessments]);

  // Assessment Result pie chart
  const resultData = useMemo(() => {
    const counts: Record<string, number> = { Satisfactory: 0, Unsatisfactory: 0, Deficient: 0 };
    assessments.forEach((a) => {
      const result = a.assessmentResult || "";
      if (counts[result] !== undefined) counts[result]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [assessments]);

  // Top 5 Vendors by severity
  const vendorData = useMemo(() => {
    const vendorMap: Record<string, { High: number; Medium: number; Low: number }> = {};
    assessments.forEach((a) => {
      const vName = a.vendor?.name || "Unknown";
      if (!vendorMap[vName]) vendorMap[vName] = { High: 0, Medium: 0, Low: 0 };
      const sev = a.inherentRisk || "Medium";
      if (sev === "High") vendorMap[vName].High++;
      else if (sev === "Low") vendorMap[vName].Low++;
      else vendorMap[vName].Medium++;
    });
    return Object.entries(vendorMap)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => (b.High + b.Medium + b.Low) - (a.High + a.Medium + a.Low))
      .slice(0, 5);
  }, [assessments]);

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
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
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
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${value}`}
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.name] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Assessment Result */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Assessment Result")}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={resultData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${value}`}
              >
                {resultData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RESULT_COLORS[entry.name] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Top 5 Vendors + Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Vendors */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Vendors")}</h3>
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
        </div>

        {/* Domains */}
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-lg font-semibold border-b pb-2 mb-4 text-primary">{t("Domains")}</h3>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            {t("Domain risk data will be populated from assessments")}
          </div>
        </div>
      </div>
    </div>
  );
}
