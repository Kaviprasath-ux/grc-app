"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ChevronRight, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Vendor {
  id: string;
  name: string;
  vrr: string | null;
}

interface Assessment {
  id: string;
  status: string;
}

const VRR_COLORS: Record<string, string> = {
  Nominal: "#93c5fd", Low: "#3b82f6", Moderate: "#f59e0b", High: "#f97316", Critical: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "#94a3b8",
  "In Progress": "#3b82f6",
  Submitted: "#8b5cf6",
  "Under Review": "#f59e0b",
  Reviewed: "#06b6d4",
  Approved: "#22c55e",
  Rejected: "#ef4444",
  Returned: "#f97316",
  Completed: "#10b981",
  Cancelled: "#6b7280",
  Expired: "#dc2626",
};

export default function RMDashboardPage() {
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, aRes] = await Promise.all([
        fetch("/api/tprm/vendors?limit=500"),
        fetch("/api/tprm/assessments?limit=500"),
      ]);
      if (vRes.ok) {
        const vJson = await vRes.json();
        setVendors(vJson.data || []);
      }
      if (aRes.ok) {
        const aJson = await aRes.json();
        setAssessments(aJson.data || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const criticalityData = useMemo(() => {
    const levels = ["Nominal", "Low", "Moderate", "High", "Critical"];
    const counts: Record<string, number> = {};
    levels.forEach((l) => (counts[l] = 0));
    vendors.forEach((v) => {
      if (v.vrr && counts[v.vrr] !== undefined) counts[v.vrr]++;
    });
    return levels.map((l) => ({ name: l, count: counts[l], color: VRR_COLORS[l] || "#94a3b8" }));
  }, [vendors]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    assessments.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      color: STATUS_COLORS[name] || "#94a3b8",
    }));
  }, [assessments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Dashboard")}</span>
      </nav>
      <h1 className="text-2xl font-bold">{t("Assessment Dashboard")}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Criticality Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Vendor Criticality")}</CardTitle>
          </CardHeader>
          <CardContent>
            {criticalityData.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={criticalityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickFormatter={(v) => t(v)} />
                  <YAxis allowDecimals={false} label={{ value: t("Vendor Count"), angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                  <Tooltip formatter={(value) => [value as number, t("Vendors")]} labelFormatter={(label) => t(label)} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {criticalityData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <p>{t("No Data to Display")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assessment Status Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Assessment Status")}</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickFormatter={(v) => t(v)} />
                  <YAxis allowDecimals={false} label={{ value: t("Assessment Count"), angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                  <Tooltip formatter={(value) => [value as number, t("Assessments")]} labelFormatter={(label) => t(label)} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <p>{t("No Data to Display")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
