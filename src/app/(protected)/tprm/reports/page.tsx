"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Search, X, FileBarChart, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface MonitoringAssessment {
  overallScore: number | null;
  securityPostureScore: number | null;
  threatExposureScore: number | null;
  calculatedOverallScore: number | null;
  calculatedSecurityPosture: number | null;
  calculatedThreatExposure: number | null;
}

interface MonitoringVendor {
  id: string;
  assessments: MonitoringAssessment[];
}

interface RawVendor {
  id: string;
  name: string;
  serviceCategory: string | null;
  vrr: string | null;
  monitoringVendor: MonitoringVendor | null;
}

interface ReportRow {
  id: string;
  name: string;
  serviceCategory: string | null;
  securityPostureScore: number | null;
  threatExposureScore: number | null;
  overallCybersecurityScore: number | null;
  criticalityRating: string | null;
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

const VALID_RATINGS = ["Critical", "High", "Moderate", "Medium", "Low", "Nominal"];

/** Convert vrr to a proper rating label. If vrr is a known label, use it. If numeric, map via thresholds. */
function normalizeVrr(vrr: string | null): string | null {
  if (!vrr) return null;
  if (VALID_RATINGS.includes(vrr)) return vrr;
  const num = parseFloat(vrr);
  if (isNaN(num)) return vrr;
  if (num >= 50) return "Critical";
  if (num >= 40) return "High";
  if (num >= 30) return "Moderate";
  if (num >= 20) return "Low";
  return "Nominal";
}

function mapVendorToRow(v: RawVendor): ReportRow {
  const ma = v.monitoringVendor?.assessments?.[0] || null;
  return {
    id: v.id,
    name: v.name,
    serviceCategory: v.serviceCategory,
    securityPostureScore: ma?.calculatedSecurityPosture ?? ma?.securityPostureScore ?? null,
    threatExposureScore: ma?.calculatedThreatExposure ?? ma?.threatExposureScore ?? null,
    overallCybersecurityScore: ma?.calculatedOverallScore ?? ma?.overallScore ?? null,
    criticalityRating: normalizeVrr(v.vrr),
  };
}

// ==================== MAIN COMPONENT ====================

export default function ReportPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) {
        const data = await res.json();
        setVendors((data.data || []).map(mapVendorToRow));
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendors"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadVendors(); }, [loadVendors]);

  const filtered = useMemo(() => vendors.filter((v) => {
    const matchesSearch = search === "" ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.serviceCategory || "").toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === "all" || v.criticalityRating === riskFilter;
    return matchesSearch && matchesRisk;
  }), [vendors, search, riskFilter]);

  const columns: ColumnDef<ReportRow>[] = [
    {
      accessorKey: "name",
      header: t("Vendor Name"),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "serviceCategory",
      header: t("Vendor Category"),
      cell: ({ row }) => <span className="text-sm">{row.original.serviceCategory || "-"}</span>,
    },
    {
      accessorKey: "securityPostureScore",
      header: t("Security Posture Score"),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.securityPostureScore != null ? row.original.securityPostureScore : "-"}
        </span>
      ),
    },
    {
      accessorKey: "threatExposureScore",
      header: t("Threat Exposure Score"),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.threatExposureScore != null ? row.original.threatExposureScore : "-"}
        </span>
      ),
    },
    {
      accessorKey: "overallCybersecurityScore",
      header: t("Overall Cybersecurity Risk Score"),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.overallCybersecurityScore != null ? row.original.overallCybersecurityScore : "-"}
        </span>
      ),
    },
    {
      accessorKey: "criticalityRating",
      header: t("Criticality Rating"),
      cell: ({ row }) => {
        const rating = row.original.criticalityRating;
        if (!rating) return <span className="text-muted-foreground">-</span>;
        return (
          <Badge variant="outline" className={`${CRITICALITY_COLORS[rating] || ""} font-medium`}>
            {t(rating)}
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
      v.criticalityRating || "",
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

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Vendor Reports")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Vendor Reports")}</h1>
          <p className="text-sm text-slate-500">{t("View and generate TPRM reports")}</p>
        </div>
        <Button className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> {t("Export")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder={t("Search by Vendor")} value={search} onChange={(e) => setSearch(e.target.value)} className="ltr:pl-9 rtl:pr-9" />
          {search && <button className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-slate-400" /></button>}
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("Risk Rating")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Ratings")}</SelectItem>
            {["Critical", "High", "Moderate", "Low", "Nominal"].map((r) => (
              <SelectItem key={r} value={r}>{t(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Report Table */}
      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <FileBarChart className="h-6 w-6 text-primary-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">{t("No vendors found")}</p>
          <p className="text-xs text-slate-400">{t("Try adjusting your search or filters")}</p>
        </div>
      ) : (
        <DataGrid columns={columns} data={filtered} hideSearch />
      )}
    </div>
  );
}
