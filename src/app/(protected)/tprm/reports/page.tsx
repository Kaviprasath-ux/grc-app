"use client";

import { useState, useEffect, useCallback } from "react";
import { Home, ChevronRight, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== TYPES ====================

interface Vendor {
  id: string;
  name: string;
  serviceCategory: string | null;
  vrr: string | null;
  securityPostureScore?: number | null;
  threatExposureScore?: number | null;
  overallCybersecurityScore?: number | null;
}

// ==================== HELPERS ====================

const CRITICALITY_COLORS: Record<string, string> = {
  Critical: "border-red-300 bg-red-50 text-red-700",
  High: "border-orange-300 bg-orange-50 text-orange-700",
  Moderate: "border-yellow-300 bg-yellow-50 text-yellow-700",
  Medium: "border-yellow-300 bg-yellow-50 text-yellow-700",
  Low: "border-green-300 bg-green-50 text-green-700",
  Nominal: "border-blue-300 bg-blue-50 text-blue-700",
};

// ==================== MAIN COMPONENT ====================

export default function ReportPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("all");

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendors"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const filtered = vendors.filter((v) => {
    const matchesRisk = riskFilter === "all" || v.vrr === riskFilter;
    return matchesRisk;
  });

  const columns: ColumnDef<Vendor>[] = [
    {
      accessorKey: "name",
      header: t("Vendor Name"),
      cell: ({ row }) => <span className="font-medium text-slate-800">{row.original.name}</span>,
    },
    {
      accessorKey: "serviceCategory",
      header: t("Vendor Category"),
      cell: ({ row }) => <span className="text-sm text-slate-600">{row.original.serviceCategory || "-"}</span>,
    },
    {
      accessorKey: "securityPostureScore",
      header: t("Security Posture Score"),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-slate-700">
          {row.original.securityPostureScore ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "threatExposureScore",
      header: t("Threat Exposure Score"),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-slate-700">
          {row.original.threatExposureScore ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "overallCybersecurityScore",
      header: t("Overall Cybersecurity Risk Score"),
      cell: ({ row }) => (
        <span className="text-sm font-medium text-slate-700">
          {row.original.overallCybersecurityScore ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "vrr",
      header: t("Criticality Rating"),
      cell: ({ row }) => {
        const vrr = row.original.vrr;
        if (!vrr) return <span className="text-slate-400">-</span>;
        return (
          <Badge variant="outline" className={`${CRITICALITY_COLORS[vrr] || ""} font-medium`}>
            {t(vrr)}
          </Badge>
        );
      },
    },
  ];

  const handleExport = () => {
    const headers = ["Vendor Name", "Vendor Category", "Security Posture Score", "Threat Exposure Score", "Overall Cybersecurity Risk Score", "Criticality Rating"];
    const rows = filtered.map((v) => [
      v.name,
      v.serviceCategory || "",
      v.securityPostureScore ?? "",
      v.threatExposureScore ?? "",
      v.overallCybersecurityScore ?? "",
      v.vrr || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendor-reports.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const riskFilterToolbar = (
    <Select value={riskFilter} onValueChange={setRiskFilter}>
      <SelectTrigger className="w-[160px] h-9 border-slate-200 text-sm">
        <SelectValue placeholder={t("All Ratings")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("All Ratings")}</SelectItem>
        {["Critical", "High", "Moderate", "Low", "Nominal"].map((r) => (
          <SelectItem key={r} value={r}>{t(r)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Vendor Reports")}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Vendor Reports")}</h1>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataGrid
          columns={columns}
          data={filtered}
          searchPlaceholder={t("Search vendors...")}
          toolbarExtra={riskFilterToolbar}
        />
      )}
    </div>
  );
}
