"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, ChevronRight, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ChartEmptyState } from "@/components/shared/chart-empty-state";

interface CriticalityItem {
  label: string;
  labelCount: number;
}

interface StatusItem {
  status: string;
  count: number;
}

const VRR_COLORS: Record<string, string> = {
  Nominal: "#93c5fd", Low: "#3b82f6", Moderate: "#f59e0b", High: "#f97316", Critical: "#ef4444",
};

// Mirrors Barchart { Count, Status } color mapping — 3 statuses only
const STATUS_COLORS: Record<string, string> = {
  Initiated:     "#3b82f6",
  "In Progress": "#f59e0b",
  Completed:     "#22c55e",
};

export default function RMDashboardPage() {
  const { t } = useLanguage();

  // Chart 1 — Vendor Criticality
  // DS_RET_Vendor_RM: isEnabled flag
  // DS_VendorNominal/Low/Moderate/High/Critical_RM: per-level counts
  const [criticalityIsEnabled, setCriticalityIsEnabled] = useState(false);
  const [criticalityRaw, setCriticalityRaw] = useState<CriticalityItem[]>([]);

  // Chart 2 — Assessment Status
  // Dataview microflow (image 24): isEnabled flag
  // DS_AssessmentInitiated/InProgress/Completed_RM (image 25): per-status counts
  const [statusIsEnabled, setStatusIsEnabled] = useState(false);
  const [statusRaw, setStatusRaw] = useState<StatusItem[]>([]);

  const [loading, setLoading] = useState(true);

  // Dynamic data translation for vendor/assessment data
  const { data: translatedCriticalityRaw } = useTranslatedData(criticalityRaw, { modelName: 'TPRMVendor' });
  const { data: translatedStatusRaw } = useTranslatedData(statusRaw, { modelName: 'TPRMAssessment' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        fetch("/api/tprm/vendors/criticality-counts"),
        fetch("/api/tprm/assessments/status-counts"),
      ]);

      if (cRes.ok) {
        const cJson = await cRes.json();
        setCriticalityIsEnabled(cJson.isEnabled);  // IsEnable from DS_RET_Vendor_RM
        setCriticalityRaw(cJson.data || []);        // { label, labelCount } per series
      }
      if (sRes.ok) {
        const sJson = await sRes.json();
        setStatusIsEnabled(sJson.isEnabled);        // IsEnable from dataview microflow (image 24)
        setStatusRaw(sJson.data || []);             // { status, count } — Barchart { Count, Status }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Map { label, labelCount } → chart shape (ColumnchartHelper.Label / LabelCount)
  const criticalityData = useMemo(() =>
    translatedCriticalityRaw.map((item) => ({
      name: item.label,
      count: item.labelCount,
      color: VRR_COLORS[item.label] || "#94a3b8",
    })),
  [translatedCriticalityRaw]);

  // Map { status, count } → chart shape (Barchart.Status / Barchart.Count)
  const statusData = useMemo(() =>
    translatedStatusRaw.map((item) => ({
      name: item.status,
      count: item.count,
      color: STATUS_COLORS[item.status] || "#94a3b8",
    })),
  [translatedStatusRaw]);

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
        {/* Chart 1 — Vendor Criticality (IsEnable from DS_RET_Vendor_RM) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Vendor Criticality")}</CardTitle>
          </CardHeader>
          <CardContent>
            {criticalityIsEnabled ? (
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
              <ChartEmptyState variant="barVertical" />
            )}
          </CardContent>
        </Card>

        {/* Chart 2 — Assessment Status (IsEnable from dataview microflow image 24) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("Assessment Status")}</CardTitle>
          </CardHeader>
          <CardContent>
            {statusIsEnabled ? (
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
              <ChartEmptyState variant="barVertical" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
