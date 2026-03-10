"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Shield,
  Activity,
  Search,
  Trash2,
  CheckCircle2,
  Loader2,
  Home,
  ChevronRight,
  Plus,
  AlertTriangle,
  TrendingUp,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHasRole } from "@/hooks/usePermissions";

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
  calculatedOverallScore: number | null;
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
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 65) return "bg-emerald-50 text-emerald-600";
  if (score >= 50) return "bg-yellow-50 text-yellow-600";
  return "bg-red-50 text-red-500";
}

function kpiCellColor(score: number | null): string {
  if (score === null) return "";
  if (score >= 80) return "text-green-700 bg-green-50/60";
  if (score >= 65) return "text-emerald-600 bg-emerald-50/40";
  if (score >= 50) return "text-yellow-600 bg-yellow-50/50";
  return "text-red-500 bg-red-50/40";
}

// ==================== KPI CELL ====================

function KpiCell({ score }: { score: number | null }) {
  if (score === null) return <td className="px-2 py-2.5 text-center"><span className="text-slate-300 text-sm">{"\u2014"}</span></td>;
  const colorCls = kpiCellColor(score);
  return (
    <td className="px-2 py-2.5 text-center">
      <span className={`inline-block text-sm font-semibold rounded-md px-3 py-1 min-w-[40px] ${colorCls}`}>
        {score}
      </span>
    </td>
  );
}

// ==================== STAT CARD ====================

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function MonitoringPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const isAuditor = useHasRole("TPRMAuditor");
  const [vendors, setVendors] = useState<TPRMMonitoringVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorDomain, setVendorDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
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
      setShowScanDialog(false);
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

  // Latest-assessment vendors (shown in main table) — must have at least one completed assessment
  const latestVendors = vendors.filter((v) =>
    v.assessments.some((a) => a.calculatedOverallScore != null || a.overallScore != null || a.status?.toLowerCase() === "done")
  );
  // Queued vendors — only those with NO completed assessment at all
  const activeJobIds = new Set(activeScans.map((s) => s.jobId));
  const latestVendorIds = new Set(latestVendors.map((v) => v.id));
  const queuedVendors = vendors.filter((v) => {
    // Never show a vendor that already appears in the scorecard table
    if (latestVendorIds.has(v.id)) return false;
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

  // Compute stats
  const totalMonitored = latestVendors.length;
  const avgScore = totalMonitored > 0
    ? Math.round(latestVendors.reduce((sum, v) => {
        const a = v.assessments[0];
        return sum + (a?.calculatedOverallScore ?? a?.overallScore ?? 0);
      }, 0) / totalMonitored)
    : 0;
  const highRiskCount = latestVendors.filter((v) => {
    const a = v.assessments[0];
    const score = a?.calculatedOverallScore ?? a?.overallScore ?? null;
    return score !== null && score < 50;
  }).length;
  const totalQueued = activeScans.length + queuedVendors.length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Continuous Monitoring")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Continuous Monitoring")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ltr:mr-2 rtl:ml-2 ${loading ? "animate-spin" : ""}`} />
            {t("Refresh")}
          </Button>
          <Button size="sm" onClick={() => { setVendorName(""); setVendorDomain(""); setShowScanDialog(true); }}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Analyze Vendor")}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Shield} label={t("Vendors Monitored")} value={totalMonitored} color="bg-primary-50 text-primary-600" />
          <StatCard icon={TrendingUp} label={t("Average Security Score")} value={avgScore} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={AlertTriangle} label={t("High Risk Vendors")} value={highRiskCount} color="bg-red-50 text-red-500" />
          <StatCard icon={ScanLine} label={t("Active Scans")} value={totalQueued} color="bg-amber-50 text-amber-600" />
        </div>
      )}

      {/* Queued Assessments Banner */}
      {(activeScans.length > 0 || queuedVendors.length > 0) && (
        <div className="border border-amber-200 bg-amber-50/50 rounded-xl px-5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            <span className="text-sm font-semibold text-slate-700">{t("Queued Assessments")}</span>
            <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">{activeScans.length + queuedVendors.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeScans.map((scan) => (
              <div key={scan.jobId} className="inline-flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                <span className="font-medium text-slate-700">{scan.vendorName}</span>
                <Badge className={scan.status === "processing" ? "bg-blue-50 text-blue-600 border border-blue-200 text-[10px] h-5" : "bg-amber-50 text-amber-600 border border-amber-200 text-[10px] h-5"}>
                  {scan.status === "processing" ? t("Processing") : t("Queued")}
                </Badge>
              </div>
            ))}
            {queuedVendors.map((v) => (
              <div key={v.id} className="inline-flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                <span className="font-medium text-slate-700">{v.vendorName}</span>
                <Badge className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] h-5">{t("Queued")}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Scorecard Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 && search === "" && latestVendors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-slate-200 rounded-xl bg-white">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{t("No monitoring data available")}</p>
          <p className="text-sm mt-1">{t("Results will appear here once the scanning API sends data")}</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
          {/* Table toolbar */}
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-primary-600" />
              <span className="font-semibold text-sm text-slate-700">{t("Vendor Scorecard")}</span>
              <span className="text-xs text-slate-400">{filtered.length} {t("vendors")}</span>
            </div>
            <div className="relative max-w-xs">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="ltr:pl-9 rtl:pr-9 bg-white h-9 text-sm" placeholder={t("Search vendors...")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("No vendors match your search")}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-50/60">
                      <th className="text-left px-4 py-3 font-semibold whitespace-nowrap sticky left-0 bg-slate-50/60 z-10">{t("Company")}</th>
                      <th className="text-center px-3 py-3 font-semibold whitespace-nowrap">{t("Security Score")}</th>
                      {KPI_COLUMNS.map((col) => (
                        <th key={col} className="text-center px-2 py-3 font-semibold whitespace-nowrap text-xs text-slate-600">{t(col)}</th>
                      ))}
                      {!isAuditor && <th className="px-3 py-3 w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v) => {
                      const a = v.assessments[0];
                      return (
                        <tr
                          key={v.id}
                          className="border-b last:border-b-0 cursor-pointer"
                          onClick={() => router.push(`/tprm/monitoring/${v.id}`)}
                        >
                          <td className="px-4 py-3 min-w-[180px] sticky left-0 bg-white z-10">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-sm text-slate-800">{v.vendorName}</div>
                              {v.vendorOnboarded && (
                                <Badge className="bg-green-50 text-green-600 text-[10px] h-5 border border-green-200">
                                  <CheckCircle2 className="h-3 w-3 ltr:mr-0.5 rtl:ml-0.5" />
                                  {t("Onboarded")}
                                </Badge>
                              )}
                            </div>
                            {v.vendorURL && (
                              <a
                                href={v.vendorURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary hover:underline truncate max-w-[160px] block mt-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {v.vendorURL}
                              </a>
                            )}
                          </td>
                          {/* Security Score — colored badge */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block font-bold text-sm rounded-lg px-4 py-1.5 min-w-[52px] ${scoreBadgeClass(a?.calculatedOverallScore ?? a?.overallScore ?? null)}`}>
                              {(a?.calculatedOverallScore ?? a?.overallScore) != null ? Math.round(a?.calculatedOverallScore ?? a?.overallScore ?? 0) : "\u2014"}
                            </span>
                          </td>
                          {/* KPI columns */}
                          {KPI_COLUMNS.map((col) => (
                            <KpiCell key={col} score={getKpiScore(a?.kpiDetails ?? [], col)} />
                          ))}
                          {/* Delete — hidden for auditor */}
                          {!isAuditor && (
                        <td className="px-3 py-2.5 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:text-red-600"
                                onClick={(e) => { e.stopPropagation(); toast({ title: t("Info"), description: t("Delete functionality coming soon") }); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                    </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination info */}
              <div className="px-4 py-2.5 border-t bg-slate-50/40 text-xs text-muted-foreground flex items-center justify-between">
                <span>{filtered.length} {t("vendors")}</span>
                <span>{t("1 to")} {filtered.length} {t("of")} {filtered.length}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Analyze Vendor Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary-600" />
              {t("Analyze Vendor")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Vendor Name")}</Label>
              <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={t("Enter vendor name")} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Vendor Domain (URL)")}</Label>
              <Input value={vendorDomain} onChange={(e) => setVendorDomain(e.target.value)} placeholder="https://example.com" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowScanDialog(false)}>{t("Cancel")}</Button>
            <Button size="sm" onClick={handleAnalyze} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 ltr:mr-1 rtl:ml-1 animate-spin" />}
              {submitting ? t("Submitting...") : t("Start Scan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
