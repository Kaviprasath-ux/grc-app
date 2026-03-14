"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Upload, Loader2, Home, ChevronRight } from "lucide-react";
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
import { useTranslatedData } from "@/hooks/useTranslatedData";

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
  status: string;
  vrr: string | null;
  monitoringVendor: MonitoringVendor | null;
}

interface ReportRow {
  id: string;
  name: string;
  serviceCategory: string | null;
  status: string;
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
    status: v.status,
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

  // Dynamic data translation for vendor names/categories
  const { data: translatedVendors } = useTranslatedData(vendors, { modelName: 'TPRMVendor' });

  const filtered = useMemo(() => translatedVendors.filter((v) => {
    const matchesRisk = riskFilter === "all" || v.criticalityRating === riskFilter;
    return matchesRisk;
  }), [translatedVendors, riskFilter]);

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
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => {
        const s = row.original.status;
        const colors: Record<string, string> = {
          Onboarding: "border-blue-300 bg-blue-50 text-blue-700",
          Onboarded: "border-green-300 bg-green-50 text-green-700",
          Offboarding: "border-amber-300 bg-amber-50 text-amber-700",
          Offboarded: "border-slate-300 bg-slate-50 text-slate-700",
          Inactive: "border-red-300 bg-red-50 text-red-700",
        };
        return <Badge variant="outline" className={`${colors[s] || ""} font-medium`}>{t(s)}</Badge>;
      },
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
    const headers = [t("Vendor Name"), t("Vendor Category"), t("Status"), t("Security Posture Score"), t("Threat Exposure Score"), t("Overall Cybersecurity Risk Score"), t("Criticality Rating")];
    const rows = filtered.map((v) => [
      v.name,
      v.serviceCategory || "",
      v.status,
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
