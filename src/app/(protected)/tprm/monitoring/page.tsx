"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield,
  Activity,
  FileCheck,
  Globe,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Search,
  Trash2,
  FileBarChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== TYPES ====================

interface TPRMLaw { id: string; lawName: string }
interface TPRMCertification { id: string; name: string }
interface TPRMComplianceAndLegal {
  id: string; privacyPolicyUrl: string | null; dpaUrl: string | null;
  laws: TPRMLaw[]; certifications: TPRMCertification[];
}
interface TPRMMonitoringRecommendation { id: string; statement: string }
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
interface TPRMPlatform { id: string; server: string }
interface TPRMHTTPHeader {
  id: string; name: string; present: boolean; value: string | null;
  recommendation: string | null; description: string | null; platforms: TPRMPlatform[];
}
interface TPRMMonitoringAssessment {
  id: string; vendorName: string; vendorURL: string; jobID: string | null;
  status: string | null; overallSummary: string | null; overallScore: number | null;
  securityPostureScore: number | null; threatExposureScore: number | null;
  securityPostureSummary: string | null; threatExposureSummary: string | null;
  lastScan: string | null; nextScan: string | null; isLatest: boolean;
  downloadType: string | null; calculatedSecurityPosture: number | null;
  calculatedThreatExposure: number | null; calculatedOverallScore: number | null;
  createdAt: string;
  complianceAndLegal: TPRMComplianceAndLegal | null;
  recommendation: TPRMMonitoringRecommendation | null;
  kpiDetails: TPRMKPIDetail[];
  httpHeaders: TPRMHTTPHeader[];
}
interface TPRMMonitoringVendor {
  id: string; vendorName: string; vendorURL: string; vendorOnboarded: boolean;
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

function scoreRingClass(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function severityBadge(sev: string | null) {
  if (!sev) return null;
  const s = sev.toLowerCase();
  if (s === "critical") return <Badge className="bg-red-100 text-red-800 text-xs">Critical</Badge>;
  if (s === "high") return <Badge className="bg-orange-100 text-orange-800 text-xs">High</Badge>;
  if (s === "medium") return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Medium</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 text-xs">{sev}</Badge>;
}

function statusBadge(status: string | null) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "completed" || s === "done") return <Badge className="bg-green-100 text-green-800">{status}</Badge>;
  if (s === "in progress" || s === "running") return <Badge className="bg-blue-100 text-blue-800">{status}</Badge>;
  if (s === "queued") return <Badge className="bg-orange-100 text-orange-800">{status}</Badge>;
  if (s === "failed" || s === "error") return <Badge className="bg-red-100 text-red-800">{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ==================== SCORE CARD ====================

function ScoreCard({ label, score, calculated, icon: Icon }: {
  label: string; score: number | null; calculated?: number | null; icon: React.ElementType;
}) {
  return (
    <div className="flex-1 border rounded-lg p-4 bg-white min-w-[130px]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${scoreRingClass(score)}`}>{score ?? "—"}</div>
      {calculated != null && (
        <div className="text-xs text-muted-foreground mt-1">Calculated: {calculated.toFixed(1)}</div>
      )}
    </div>
  );
}

// ==================== DETAIL SHEET ====================

function AssessmentDetailSheet({ vendor, open, onClose }: {
  vendor: TPRMMonitoringVendor | null; open: boolean; onClose: () => void;
}) {
  const { t } = useLanguage();
  const assessment = vendor?.assessments[0] ?? null;
  if (!vendor || !assessment) return null;

  const headersPresent = assessment.httpHeaders.filter((h) => h.present).length;
  const headersMissing = assessment.httpHeaders.filter((h) => !h.present).length;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-3xl overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b bg-slate-50 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight truncate">{vendor.vendorName}</SheetTitle>
              <a href={vendor.vendorURL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline mt-0.5">
                <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{vendor.vendorURL}</span>
              </a>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {statusBadge(assessment.status)}
              {assessment.isLatest && <Badge className="bg-blue-100 text-blue-800 text-xs">Latest</Badge>}
              {vendor.vendorOnboarded && <Badge className="bg-green-100 text-green-800 text-xs">Onboarded</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
            {assessment.jobID && <span>Job ID: <strong className="text-foreground">{assessment.jobID}</strong></span>}
            {assessment.lastScan && <span>Last Scan: <strong className="text-foreground">{fmtDate(assessment.lastScan)}</strong></span>}
            {assessment.nextScan && <span>Next Scan: <strong className="text-foreground">{assessment.nextScan}</strong></span>}
            {assessment.downloadType && <span>Type: <strong className="text-foreground">{assessment.downloadType}</strong></span>}
          </div>
        </SheetHeader>

        {/* Score Cards */}
        <div className="px-6 py-4 border-b">
          <div className="flex gap-3 flex-wrap">
            <ScoreCard label={t("Overall Score")} score={assessment.overallScore} calculated={assessment.calculatedOverallScore} icon={Activity} />
            <ScoreCard label={t("Security Posture")} score={assessment.securityPostureScore} calculated={assessment.calculatedSecurityPosture} icon={Shield} />
            <ScoreCard label={t("Threat Exposure")} score={assessment.threatExposureScore} calculated={assessment.calculatedThreatExposure} icon={AlertTriangle} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="px-6 py-4">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
            <TabsTrigger value="compliance">{t("Compliance & Legal")}</TabsTrigger>
            <TabsTrigger value="kpi">
              {t("KPI Details")}
              {assessment.kpiDetails.length > 0 && (
                <span className="ml-1.5 bg-primary/10 text-primary text-xs rounded-full px-1.5 py-0.5">{assessment.kpiDetails.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="headers">
              {t("HTTP Headers")}
              {assessment.httpHeaders.length > 0 && (
                <span className="ml-1.5 bg-primary/10 text-primary text-xs rounded-full px-1.5 py-0.5">{headersPresent}/{assessment.httpHeaders.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            {assessment.overallSummary && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"><Activity className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{t("Overall Summary")}</span></div>
                <p className="text-sm text-muted-foreground leading-relaxed">{assessment.overallSummary}</p>
              </div>
            )}
            {assessment.securityPostureSummary && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{t("Security Posture Summary")}</span></div>
                <p className="text-sm text-muted-foreground leading-relaxed">{assessment.securityPostureSummary}</p>
              </div>
            )}
            {assessment.threatExposureSummary && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{t("Threat Exposure Summary")}</span></div>
                <p className="text-sm text-muted-foreground leading-relaxed">{assessment.threatExposureSummary}</p>
              </div>
            )}
            {assessment.recommendation && (
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-2"><Info className="h-4 w-4 text-blue-600" /><span className="text-sm font-medium text-blue-900">{t("Recommendation")}</span></div>
                <p className="text-sm text-blue-800 leading-relaxed">{assessment.recommendation.statement}</p>
              </div>
            )}
            {!assessment.overallSummary && !assessment.securityPostureSummary && !assessment.threatExposureSummary && !assessment.recommendation && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("No overview data available")}</p>
            )}
          </TabsContent>

          {/* COMPLIANCE & LEGAL */}
          <TabsContent value="compliance" className="space-y-4 mt-0">
            {assessment.complianceAndLegal ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2"><Globe className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{t("Privacy Policy")}</span></div>
                    {assessment.complianceAndLegal.privacyPolicyUrl ? (
                      <a href={assessment.complianceAndLegal.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 break-all">
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />{assessment.complianceAndLegal.privacyPolicyUrl}
                      </a>
                    ) : <p className="text-sm text-muted-foreground">—</p>}
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2"><FileCheck className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{t("DPA URL")}</span></div>
                    {assessment.complianceAndLegal.dpaUrl ? (
                      <a href={assessment.complianceAndLegal.dpaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 break-all">
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />{assessment.complianceAndLegal.dpaUrl}
                      </a>
                    ) : <p className="text-sm text-muted-foreground">—</p>}
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <span className="text-sm font-medium mb-3 block">{t("Applicable Laws")}</span>
                  {assessment.complianceAndLegal.laws.length > 0 ? (
                    <div className="flex flex-wrap gap-2">{assessment.complianceAndLegal.laws.map((l) => <Badge key={l.id} variant="outline" className="text-xs">{l.lawName}</Badge>)}</div>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </div>
                <div className="border rounded-lg p-4">
                  <span className="text-sm font-medium mb-3 block">{t("Certifications")}</span>
                  {assessment.complianceAndLegal.certifications.length > 0 ? (
                    <div className="flex flex-wrap gap-2">{assessment.complianceAndLegal.certifications.map((c) => <Badge key={c.id} className="bg-green-100 text-green-800 text-xs">{c.name}</Badge>)}</div>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground text-center py-8">{t("No compliance data available")}</p>}
          </TabsContent>

          {/* KPI DETAILS */}
          <TabsContent value="kpi" className="mt-0">
            {assessment.kpiDetails.length > 0 ? (
              <Accordion type="multiple" className="space-y-2">
                {assessment.kpiDetails.map((kpi) => (
                  <AccordionItem key={kpi.id} value={kpi.id} className="border rounded-lg px-4">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1 min-w-0 ltr:pr-2 rtl:pl-2">
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-sm font-medium">{kpi.kpiName}</span>
                          {kpi.kpiType && <span className="text-xs text-muted-foreground ml-2">({kpi.kpiType})</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {severityBadge(kpi.severity)}
                          {kpi.securityScore != null && (
                            <Badge className={`${scoreBadgeClass(kpi.securityScore)} text-xs`}>Score: {kpi.securityScore}</Badge>
                          )}
                          {kpi.riskScore != null && <Badge variant="outline" className="text-xs">Risk: {kpi.riskScore}</Badge>}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-3">
                      {(kpi.cveId || kpi.affectedComponent) && (
                        <div className="flex gap-4 text-xs">
                          {kpi.cveId && <span className="text-muted-foreground">CVE: <strong className="text-foreground font-mono">{kpi.cveId}</strong></span>}
                          {kpi.affectedComponent && <span className="text-muted-foreground">Affected: <strong className="text-foreground">{kpi.affectedComponent}</strong></span>}
                        </div>
                      )}
                      {kpi.summary && <div><p className="text-xs font-medium text-muted-foreground mb-1">{t("Summary")}</p><p className="text-sm leading-relaxed">{kpi.summary}</p></div>}
                      {kpi.description && <div><p className="text-xs font-medium text-muted-foreground mb-1">{t("Description")}</p><p className="text-sm leading-relaxed">{kpi.description}</p></div>}
                      {kpi.recommendation && (
                        <div className="bg-blue-50 rounded p-3">
                          <p className="text-xs font-medium text-blue-700 mb-1">{t("Recommendation")}</p>
                          <p className="text-sm text-blue-800 leading-relaxed">{kpi.recommendation}</p>
                        </div>
                      )}
                      {kpi.keyFindings.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">{t("Key Findings")}</p>
                          <ul className="space-y-1">{kpi.keyFindings.map((f) => (
                            <li key={f.id} className="text-sm flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />{f.statement}</li>
                          ))}</ul>
                        </div>
                      )}
                      {kpi.sources.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">{t("Sources")}</p>
                          <div className="flex flex-wrap gap-1.5">{kpi.sources.map((s) => <Badge key={s.id} variant="outline" className="text-xs">{s.name}</Badge>)}</div>
                        </div>
                      )}
                      {kpi.vulnerabilities.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">{t("Vulnerabilities")}</p>
                          <div className="space-y-2">{kpi.vulnerabilities.map((v) => (
                            <div key={v.id} className="border rounded p-3 text-sm space-y-1">
                              <div className="flex items-center gap-2">{v.cveId && <span className="font-medium font-mono">{v.cveId}</span>}{severityBadge(v.severity)}</div>
                              {v.affectedComponent && <p className="text-muted-foreground text-xs">Component: {v.affectedComponent}</p>}
                              {v.description && <p className="text-xs leading-relaxed">{v.description}</p>}
                            </div>
                          ))}</div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : <p className="text-sm text-muted-foreground text-center py-8">{t("No KPI data available")}</p>}
          </TabsContent>

          {/* HTTP HEADERS */}
          <TabsContent value="headers" className="mt-0">
            {assessment.httpHeaders.length > 0 ? (
              <div className="space-y-2">
                <div className="flex gap-4 text-sm mb-3">
                  <span className="flex items-center gap-1.5 text-green-700"><CheckCircle2 className="h-4 w-4" /> {headersPresent} {t("Present")}</span>
                  <span className="flex items-center gap-1.5 text-red-600"><XCircle className="h-4 w-4" /> {headersMissing} {t("Missing")}</span>
                </div>
                <Accordion type="multiple" className="space-y-1">
                  {assessment.httpHeaders.map((hdr) => (
                    <AccordionItem key={hdr.id} value={hdr.id} className="border rounded-lg px-4">
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-3 flex-1 min-w-0 ltr:pr-2 rtl:pl-2">
                          {hdr.present ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                          <span className="text-sm font-medium font-mono flex-1 text-left">{hdr.name}</span>
                          {hdr.value && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{hdr.value}</span>}
                          {hdr.platforms.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Server className="h-3 w-3" />{hdr.platforms.map((p) => p.server).join(", ")}
                            </div>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4 space-y-2">
                        {hdr.description && <div><p className="text-xs font-medium text-muted-foreground mb-1">{t("Description")}</p><p className="text-sm leading-relaxed">{hdr.description}</p></div>}
                        {hdr.recommendation && (
                          <div className="bg-blue-50 rounded p-3">
                            <p className="text-xs font-medium text-blue-700 mb-1">{t("Recommendation")}</p>
                            <p className="text-sm text-blue-800 leading-relaxed">{hdr.recommendation}</p>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-8">{t("No HTTP header data available")}</p>}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// ==================== KPI CELL ====================

function KpiCell({ score }: { score: number | null }) {
  if (score === null) return <td className="px-2 py-2.5 text-center"><span className="text-slate-300 text-sm">—</span></td>;
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
  const { toast } = useToast();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<TPRMMonitoringVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorDomain, setVendorDomain] = useState("");
  const [selected, setSelected] = useState<TPRMMonitoringVendor | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const openDetail = (v: TPRMMonitoringVendor) => { setSelected(v); setSheetOpen(true); };

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
                      onClick={() => openDetail(v)}
                    >
                      <td className="px-4 py-3 border-r min-w-[160px]">
                        <div className="font-medium text-sm">{v.vendorName}</div>
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
                          {a?.overallScore ?? "—"}
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

      {/* Detail Sheet */}
      <AssessmentDetailSheet vendor={selected} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
