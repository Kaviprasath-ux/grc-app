"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Home, ChevronRight, Loader2, Info } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

// ── Color Maps ──
const ISSUE_STATUS_COLORS: Record<string, string> = {
  Open: "#ef4444", Overdue: "#f97316", Closed: "#22c55e",
};
const ASSESSMENT_PROGRESS_COLORS: Record<string, string> = {
  Initiated: "#eab308", "In Progress": "#a78bfa", Completed: "#10b981",
};
const VRR_COLORS: Record<string, string> = {
  Critical: "#ef4444", High: "#f97316", Moderate: "#eab308", Low: "#22c55e", Nominal: "#3b82f6",
};
const RESULT_COLORS: Record<string, string> = {
  Satisfactory: "#10b981", Unsatisfactory: "#f97316", Deficient: "#eab308",
};
const SEVERITY_COLORS: Record<string, string> = {
  High: "#ef4444", Medium: "#f59e0b", Low: "#22c55e",
};
const TOP5_COLORS = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

// ── Info descriptions (from Mendix) ──
const CHART_INFO: Record<string, string> = {
  issueStatus: "The Issue Status chart provides a consolidated view of all findings identified across assessments. It categorizes issues based on their current stage—such as open, overdue, or closed. This allows teams to track remediation progress, prioritize high-risk items, and ensure timely closure.",
  assessmentProgress: "Assessments presents a comprehensive list of all evaluations, detailing their status as initiated, in progress, or completed. This structured view facilitates effective tracking and management of each assessment's lifecycle, ensuring oversight and timely completion.",
  inherentRisk: "The Inherent Risk Status chart illustrates the baseline risk level associated with each vendor or engagement before controls are applied. It categorizes inherent risk into levels such as low, medium, high, or critical. This view supports effective risk profiling.",
  assessmentResult: "The Assessment Result chart summarizes the outcomes of completed evaluations, displaying vendors' performance across risk categories. It highlights ratings such as satisfactory, unsatisfactory, and deficient. This provides a quick snapshot of overall risk posture.",
  openIssues: "The Open Issues chart highlights the count of active issues with their severity rating. This visual helps risk managers quickly identify critical items and potential compliance gaps.",
  overdueIssues: "The Overdue Issues chart highlights the count of active issues that have exceeded their remediation deadlines. This helps teams escalate critical risks, strengthen vendor communication, and maintain accountability.",
  top5Vendors: "The Top 5 Vendors chart identifies the highest-risk vendors based on issue volume and severity. This spotlight view helps teams quickly assess where concentrated risk lies within their vendor ecosystem.",
  top5Domains: "The Top 5 Domains chart showcases the risk distribution across different business or technical domains, highlighting the areas with the highest exposure or issue concentration.",
};

interface DashboardData {
  assessmentProgress: Record<string, number>;
  inherentRisk: Record<string, number>;
  assessmentResult: Record<string, number>;
  issueStatus: Record<string, number>;
  openIssuesBySeverity: Record<string, number>;
  overdueIssuesBySeverity: Record<string, number>;
  top5Vendors: { name: string; high: number; medium: number; low: number }[];
  top5Domains: { name: string; high: number; medium: number; low: number }[];
}

// ── Custom label for pie charts ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCustomLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, value } = props;
  if (value === 0) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={600}>{value}</text>;
};

export default function BODashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [infoKey, setInfoKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/bo-dashboard");
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  // Prepare chart data
  const issueStatusData = Object.entries(data.issueStatus).map(([name, count]) => ({ name, count, color: ISSUE_STATUS_COLORS[name] || "#94a3b8" }));
  const assessmentProgressData = Object.entries(data.assessmentProgress).map(([name, count]) => ({ name, count, color: ASSESSMENT_PROGRESS_COLORS[name] || "#94a3b8" }));
  const inherentRiskData = Object.entries(data.inherentRisk).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, fill: VRR_COLORS[name] || "#94a3b8" }));
  const assessmentResultData = Object.entries(data.assessmentResult).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, fill: RESULT_COLORS[name] || "#94a3b8" }));
  const openIssuesData = Object.entries(data.openIssuesBySeverity).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] || "#94a3b8" }));
  const overdueIssuesData = Object.entries(data.overdueIssuesBySeverity).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] || "#94a3b8" }));

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500"><Home className="h-4 w-4" /><span>{t("TPRM")}</span></div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Dashboard")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Assessment Dashboard")}</h1>

      {/* ── ASSESSMENTS ── */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase writing-mode-vertical ltr:border-l-4 rtl:border-r-4 border-primary ltr:pl-2 rtl:pr-2">{t("ASSESSMENTS")}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t("Issue Status")} infoKey="issueStatus" onInfo={setInfoKey}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={issueStatusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickFormatter={(v) => t(v)} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v) => [v as number, t("Issues")]} labelFormatter={(l) => t(l)} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {issueStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("Assessment Progress")} infoKey="assessmentProgress" onInfo={setInfoKey}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={assessmentProgressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickFormatter={(v) => t(v)} />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(v) => [v as number, t("Assessments")]} labelFormatter={(l) => t(l)} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {assessmentProgressData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── VENDORS ── */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase ltr:border-l-4 rtl:border-r-4 border-primary ltr:pl-2 rtl:pr-2">{t("VENDORS")}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t("Inherent Risk")} infoKey="inherentRisk" onInfo={setInfoKey}>
          {inherentRiskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={inherentRiskData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={renderCustomLabel} labelLine={false}>
                  {inherentRiskData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend formatter={(v) => t(v)} />
                <Tooltip formatter={(v) => [v as number, t("Vendors")]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart t={t} />}
        </ChartCard>

        <ChartCard title={t("Assessment Result")} infoKey="assessmentResult" onInfo={setInfoKey}>
          {assessmentResultData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={assessmentResultData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={renderCustomLabel} labelLine={false}>
                  {assessmentResultData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend formatter={(v) => t(v)} />
                <Tooltip formatter={(v) => [v as number, t("Assessments")]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart t={t} />}
        </ChartCard>
      </div>

      {/* ── ISSUES ── */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase ltr:border-l-4 rtl:border-r-4 border-primary ltr:pl-2 rtl:pr-2">{t("ISSUES")}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t("Open Issues")} infoKey="openIssues" onInfo={setInfoKey}>
          {openIssuesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={openIssuesData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={renderCustomLabel} labelLine={false}>
                  {openIssuesData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend formatter={(v) => t(v)} />
                <Tooltip formatter={(v) => [v as number, t("Issues")]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart t={t} />}
        </ChartCard>

        <ChartCard title={t("Overdue Issues")} infoKey="overdueIssues" onInfo={setInfoKey}>
          {overdueIssuesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={overdueIssuesData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={renderCustomLabel} labelLine={false}>
                  {overdueIssuesData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Legend formatter={(v) => t(v)} />
                <Tooltip formatter={(v) => [v as number, t("Issues")]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart t={t} />}
        </ChartCard>
      </div>

      {/* ── TOP 5 ── */}
      <div className="flex items-center gap-2">
        <div className="text-xs font-bold tracking-widest text-slate-400 uppercase ltr:border-l-4 rtl:border-r-4 border-primary ltr:pl-2 rtl:pr-2">{t("TOP 5")}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title={t("Vendors")} infoKey="top5Vendors" onInfo={setInfoKey}>
          {data.top5Vendors.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.top5Vendors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Legend formatter={(v) => t(v === "high" ? "High Severity" : v === "medium" ? "Medium Severity" : "Low Severity")} />
                <Bar dataKey="high" stackId="a" fill={TOP5_COLORS.high} name="high" />
                <Bar dataKey="medium" stackId="a" fill={TOP5_COLORS.medium} name="medium" />
                <Bar dataKey="low" stackId="a" fill={TOP5_COLORS.low} name="low" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart t={t} />}
        </ChartCard>

        <ChartCard title={t("Domains")} infoKey="top5Domains" onInfo={setInfoKey}>
          {data.top5Domains.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.top5Domains} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Legend formatter={(v) => t(v === "high" ? "High Severity" : v === "medium" ? "Medium Severity" : "Low Severity")} />
                <Bar dataKey="high" stackId="a" fill={TOP5_COLORS.high} name="high" />
                <Bar dataKey="medium" stackId="a" fill={TOP5_COLORS.medium} name="medium" />
                <Bar dataKey="low" stackId="a" fill={TOP5_COLORS.low} name="low" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart t={t} />}
        </ChartCard>
      </div>

      {/* ── Info Dialog ── */}
      <Dialog open={!!infoKey} onOpenChange={(open) => { if (!open) setInfoKey(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{infoKey ? t(infoKey === "issueStatus" ? "Issue Status" : infoKey === "assessmentProgress" ? "Assessment Progress" : infoKey === "inherentRisk" ? "Inherent Risk" : infoKey === "assessmentResult" ? "Assessment Result" : infoKey === "openIssues" ? "Open Issues" : infoKey === "overdueIssues" ? "Overdue Issues" : infoKey === "top5Vendors" ? "Vendors" : "Domains") : ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 leading-relaxed">
            {infoKey ? t(CHART_INFO[infoKey] || "") : ""}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ──

function ChartCard({ title, infoKey, onInfo, children }: {
  title: string; infoKey: string; onInfo: (key: string) => void; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onInfo(infoKey)}>
          <Info className="h-4 w-4 text-slate-400" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ t }: { t: (s: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
      <p className="text-sm">{t("No Data to Display")}</p>
    </div>
  );
}
