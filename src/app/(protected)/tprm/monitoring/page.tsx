"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Loader2,
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
  const [submitting, setSubmitting] = useState(false);
  const [activeScans, setActiveScans] = useState<{ jobId: string; vendorName: string; vendorURL: string; status: string }[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/monitoring");
      if (res.ok) {
        const json = await res.json();
        const vendorList: TPRMMonitoringVendor[] = json.data || [];
        setVendors(vendorList);

        // Resume polling for any DB-tracked pending scans (survives page navigation)
        const pendingFromDb = vendorList
          .filter((v) => {
            const a = v.assessments[0];
            return a && ["queued", "processing"].includes(a.status?.toLowerCase() || "") && a.jobID;
          })
          .map((v) => ({
            jobId: v.assessments[0].jobID!,
            vendorName: v.vendorName,
            vendorURL: v.vendorURL,
            status: v.assessments[0].status || "queued",
          }));

        if (pendingFromDb.length > 0) {
          setActiveScans((prev) => {
            const existingIds = new Set(prev.map((s) => s.jobId));
            const newScans = pendingFromDb.filter((s) => !existingIds.has(s.jobId));
            return newScans.length > 0 ? [...prev, ...newScans] : prev;
          });
        }
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

  // Background poller — runs whenever there are active scans
  useEffect(() => {
    if (activeScans.length === 0) {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      return;
    }
    // Don't start a second interval if one is already running
    if (pollIntervalRef.current) return;

    pollIntervalRef.current = setInterval(async () => {
      setActiveScans((prev) => {
        // Trigger poll for each active scan (fire-and-forget inside setState to get latest list)
        for (const scan of prev) {
          fetch(`/api/tprm/monitoring/scan?jobId=${scan.jobId}`)
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              if (!data) return;
              if (data.status === "done") {
                setActiveScans((p) => p.filter((s) => s.jobId !== scan.jobId));
                if (data.error) {
                  toast({ title: t("Scan Error"), description: `${scan.vendorName}: ${data.error}`, variant: "destructive" });
                } else {
                  toast({ title: t("Scan Complete"), description: `${scan.vendorName} ${t("assessment has been saved successfully")}` });
                }
                loadData();
              } else if (data.status === "error") {
                setActiveScans((p) => p.filter((s) => s.jobId !== scan.jobId));
                toast({ title: t("Scan Failed"), description: `${scan.vendorName}: ${data.error || t("An error occurred during scanning")}`, variant: "destructive" });
              } else if (data.status === "processing" && scan.status !== "processing") {
                setActiveScans((p) => p.map((s) => s.jobId === scan.jobId ? { ...s, status: "processing" } : s));
              }
            })
            .catch(() => { /* network error — keep polling */ });
        }
        return prev;
      });
    }, 60000);

    return () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    };
  }, [activeScans.length, toast, t, loadData]);

  const handleAnalyze = async () => {
    if (!vendorName.trim() && !vendorDomain.trim()) {
      toast({ title: t("Error"), description: t("Please enter a vendor name or domain"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tprm/monitoring/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorName: vendorName.trim(), vendorURL: vendorDomain.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit scan");
      }

      const { jobId } = await res.json();
      const newScan = { jobId, vendorName: vendorName.trim(), vendorURL: vendorDomain.trim(), status: "queued" };
      setActiveScans((prev) => [...prev, newScan]);
      toast({ title: t("Assessment Triggered"), description: `${vendorName.trim()} ${t("has been queued for scanning. This may take a few minutes.")}` });
      setVendorName("");
      setVendorDomain("");
    } catch (err) {
      toast({
        title: t("Error"),
        description: err instanceof Error ? err.message : t("Failed to submit scan"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Latest-assessment vendors (shown in main table)
  const latestVendors = vendors.filter((v) => v.assessments.length > 0);
  // Queued vendors (submitted but no assessment yet, or status = queued/processing)
  // Exclude vendors already tracked in activeScans to avoid duplicates
  const activeJobIds = new Set(activeScans.map((s) => s.jobId));
  const queuedVendors = vendors.filter((v) => {
    const a = v.assessments[0];
    const isPending = v.assessments.length === 0 ||
      ["queued", "processing"].includes(a?.status?.toLowerCase() || "");
    const isTracked = a?.jobID && activeJobIds.has(a.jobID);
    return isPending && !isTracked;
  });

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
          <Button onClick={handleAnalyze} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />}
            {submitting ? t("Submitting...") : t("Analyze Vendor")}
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
        {activeScans.length === 0 && queuedVendors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("No Data Found")}</p>
        ) : (
          <div className="space-y-2">
            {/* Active scans (locally tracked, not yet persisted) */}
            {activeScans.map((scan) => (
              <div key={scan.jobId} className="flex items-center justify-between border rounded p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  <div>
                    <span className="font-medium text-sm">{scan.vendorName}</span>
                    <span className="text-xs text-muted-foreground ltr:ml-2 rtl:mr-2">{scan.vendorURL}</span>
                  </div>
                </div>
                <Badge className={scan.status === "processing" ? "bg-blue-100 text-blue-700 text-xs" : "bg-orange-100 text-orange-700 text-xs"}>
                  {scan.status === "processing" ? t("Processing") : t("Queued")}
                </Badge>
              </div>
            ))}
            {/* DB-queued vendors */}
            {queuedVendors.map((v) => (
              <div key={v.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <span className="font-medium text-sm">{v.vendorName}</span>
                  <span className="text-xs text-muted-foreground ltr:ml-2 rtl:mr-2">{v.vendorURL}</span>
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
