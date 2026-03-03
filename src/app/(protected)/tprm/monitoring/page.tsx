"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  ExternalLink,
  Shield,
  Activity,
  Search,
  Trash2,
  FileBarChart,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== TYPES ====================

interface TPRMKeyFinding { id: string; statement: string }
interface TPRMSource { id: string; name: string }
interface TPRMVulnerabilityFinding {
  id: string; cveId: string | null; severity: string | null;
  affectedComponent: string | null; description: string | null;
}
interface TPRMKPIDetail {
  id: string; kpiName: string; kpiType: string | null;
  securityScore: number | null; summary: string | null; riskScore: number | null;
  recommendation: string | null; cveId: string | null; severity: string | null;
  description: string | null; affectedComponent: string | null;
  keyFindings: TPRMKeyFinding[]; sources: TPRMSource[];
  vulnerabilities: TPRMVulnerabilityFinding[];
}
interface TPRMMonitoringAssessment {
  id: string; vendorName: string; vendorURL: string; jobID: string | null;
  status: string | null; overallScore: number | null;
  isLatest: boolean;
  createdAt: string;
  kpiDetails: TPRMKPIDetail[];
}
interface TPRMMonitoringVendor {
  id: string; vendorName: string; vendorURL: string; vendorOnboarded: boolean;
  tprmVendorId: string | null;
  assessments: TPRMMonitoringAssessment[];
}

// ==================== KPI COLUMN DEFINITIONS ====================

const KPI_COLUMNS = [
  "Network Security", "DNS Health", "Patching Cadence", "Endpoint Security",
  "IP Reputation", "Application Security", "Cubit Score", "Email Security",
  "SSL/TLS Configuration", "Privacy", "Known Breach", "Hacker Chatter",
  "Information Leak", "Social Engineering",
] as const;

// ==================== HELPERS ====================

function getKpiScore(details: TPRMKPIDetail[], name: string): number | null {
  return details.find((k) => k.kpiName === name)?.securityScore ?? null;
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-400";
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

// ==================== KPI CELL ====================

function KpiCell({ score }: { score: number | null }) {
  if (score === null) return <td className="px-2 py-2.5 text-center"><span className="text-slate-300 text-sm">{"\u2014"}</span></td>;
  return (
    <td className="px-2 py-2.5 text-center">
      <span className="inline-block bg-[#f5f3ee] text-slate-700 text-sm font-medium rounded-md px-3 py-1 min-w-[40px]">
        {score}
      </span>
    </td>
  );
}

// ==================== MAIN PAGE ====================

export default function MonitoringPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<TPRMMonitoringVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorDomain, setVendorDomain] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/monitoring");
      if (res.ok) {
        const json = await res.json();
        setVendors(json.data || []);
      } else {
        toast({ title: t("Error"), description: t("Failed to load monitoring data"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Network error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAnalyze = () => {
    if (!vendorName.trim() && !vendorDomain.trim()) {
      toast({ title: t("Error"), description: t("Please enter a vendor name or domain"), variant: "destructive" });
      return;
    }
    toast({ title: t("Info"), description: t("Vendor analysis will be available when the scanning API is connected") });
  };

  // Latest-assessment vendors (shown in main table)
  const latestVendors = vendors.filter((v) => v.assessments.length > 0);
  // Queued vendors (submitted but no assessment yet, or status = queued)
  const queuedVendors = vendors.filter((v) =>
    v.assessments.length === 0 ||
    v.assessments[0]?.status?.toLowerCase() === "queued"
  );

  const filtered = latestVendors.filter(
    (v) =>
      v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
      v.vendorURL.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Continuous Monitoring")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ltr:mr-1 rtl:ml-1 ${loading ? "animate-spin" : ""}`} />
            {t("Refresh")}
          </Button>
          <Button variant="outline" size="sm">
            <FileBarChart className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
            {t("Vendor Reports")}
          </Button>
        </div>
      </div>

      {/* Analyze Vendor Input */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
          <div>
            <Label>{t("Vendor Name")}</Label>
            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={t("Enter vendor name")} />
          </div>
          <div>
            <Label>{t("Vendor Domain (URL)")}</Label>
            <Input value={vendorDomain} onChange={(e) => setVendorDomain(e.target.value)} placeholder="https://example.com" />
          </div>
          <Button onClick={handleAnalyze}>
            {t("Analyze Vendor")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="ltr:pl-9 rtl:pr-9" placeholder={t("Search vendors...")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Main Scorecard Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-white">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{t("No monitoring data available")}</p>
          <p className="text-sm mt-1">{t("Results will appear here once the scanning API sends data")}</p>
        </div>
      ) : (
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-white">
                  <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">{t("Company")}</th>
                  <th className="text-center px-3 py-3 font-semibold whitespace-nowrap">{t("Security Score")}</th>
                  {KPI_COLUMNS.map((col) => (
                    <th key={col} className="text-center px-2 py-3 font-semibold whitespace-nowrap text-xs">{t(col)}</th>
                  ))}
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const a = v.assessments[0];
                  return (
                    <tr
                      key={v.id}
                      className="border-b last:border-b-0 hover:bg-slate-50/50 cursor-pointer"
                      onClick={() => router.push(`/tprm/monitoring/${v.id}`)}
                    >
                      <td className="px-4 py-3 border-r min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm">{v.vendorName}</div>
                          {v.vendorOnboarded && (
                            <Badge className="bg-green-100 text-green-700 text-xs h-5">
                              <CheckCircle2 className="h-3 w-3 ltr:mr-0.5 rtl:ml-0.5" />
                              {t("Onboarded")}
                            </Badge>
                          )}
                        </div>
                        <a
                          href={v.vendorURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate max-w-[150px] block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {v.vendorURL}
                        </a>
                      </td>
                      {/* Security Score — colored badge */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block font-bold text-sm rounded-md px-4 py-1.5 min-w-[52px] ${scoreBadgeClass(a?.overallScore ?? null)}`}>
                          {a?.overallScore ?? "\u2014"}
                        </span>
                      </td>
                      {/* KPI columns */}
                      {KPI_COLUMNS.map((col) => (
                        <KpiCell key={col} score={getKpiScore(a?.kpiDetails ?? [], col)} />
                      ))}
                      {/* Delete */}
                      <td className="px-3 py-2.5 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={(e) => { e.stopPropagation(); toast({ title: t("Info"), description: t("Delete functionality coming soon") }); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination info */}
          <div className="px-4 py-2.5 border-t text-xs text-muted-foreground flex justify-end">
            {t("1 to")} {filtered.length} {t("of")} {filtered.length}
          </div>
        </div>
      )}

      {/* Queued Assessments */}
      <div className="border rounded-lg bg-white p-4">
        <h4 className="text-base font-semibold mb-3">{t("Queued Assessments")}</h4>
        {queuedVendors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("No Data Found")}</p>
        ) : (
          <div className="space-y-2">
            {queuedVendors.map((v) => (
              <div key={v.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <span className="font-medium text-sm">{v.vendorName}</span>
                  <span className="text-xs text-muted-foreground ml-2">{v.vendorURL}</span>
                </div>
                <Badge className="bg-orange-100 text-orange-700 text-xs">{t("Queued")}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
