"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  Activity,
  AlertTriangle,
  Plus,
  Minus,
  UserPlus,
  CheckCircle2,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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
  tprmVendorId: string | null;
  assessments: TPRMMonitoringAssessment[];
}

// ==================== KPI CATEGORY DEFINITIONS ====================

const SECURITY_POSTURE_KPIS = [
  "Network Security", "DNS Health", "Patching Cadence", "Endpoint Security",
  "IP Reputation", "Application Security", "Cubit Score", "Email Security",
  "SSL/TLS Configuration", "Privacy",
];

const THREAT_EXPOSURE_KPIS = [
  "Known Breach", "Hacker Chatter", "Information Leak", "Social Engineering",
];

// ==================== HELPERS ====================

function fmtDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtShortDate(d: string | null) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString(undefined, { year: "2-digit", month: "numeric", day: "numeric" });
}

function scoreColor(score: number | null): string {
  if (score === null) return "#94a3b8";
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

function severityBadgeClass(sev: string): string {
  const s = sev.toLowerCase();
  if (s === "critical") return "bg-red-100 text-red-800 border-red-200";
  if (s === "high") return "bg-orange-100 text-orange-800 border-orange-200";
  if (s === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

// ==================== SCORE CIRCLE ====================

function ScoreCircle({ score, size = 64 }: { score: number | null; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? score / 100 : 0;
  const color = scoreColor(score);

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      {score != null && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="text-sm font-bold" fill={color}>
        {score != null ? score.toFixed(score % 1 === 0 ? 0 : 2) : "\u2014"}
      </text>
    </svg>
  );
}

// ==================== KPI CARD ====================

function KpiCard({ kpi, isThreat, expanded, onToggle, t }: {
  kpi: TPRMKPIDetail;
  isThreat: boolean;
  expanded: boolean;
  onToggle: () => void;
  t: (s: string) => string;
}) {
  const borderColor = isThreat ? "border-l-amber-500" : "border-l-teal-500";
  const bgColor = isThreat ? "bg-amber-50" : "bg-teal-50";
  const iconBg = isThreat ? "bg-amber-100 text-amber-600" : "bg-teal-100 text-teal-600";
  const scoreTextColor = isThreat ? "text-amber-700" : "text-teal-700";

  return (
    <div className={`border rounded-lg border-l-4 ${borderColor} overflow-hidden`}>
      {/* Header */}
      <div
        className={`${bgColor} px-4 py-3 flex items-center justify-between cursor-pointer`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded flex items-center justify-center ${iconBg}`}>
            <Network className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm truncate">{kpi.kpiName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-2xl font-bold ${scoreTextColor}`}>
            {kpi.securityScore ?? "\u2014"}
          </span>
          <button className="text-slate-500 hover:text-slate-700 p-0.5">
            {expanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-4 space-y-4 bg-white border-t">
          {kpi.summary && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> {t("Summary")}
              </p>
              <p className="text-sm leading-relaxed text-slate-700">{kpi.summary}</p>
            </div>
          )}
          {kpi.keyFindings.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> {t("Key Findings")}
              </p>
              <ul className="space-y-2">
                {kpi.keyFindings.map((f) => (
                  <li key={f.id} className="text-sm flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    {f.statement}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kpi.sources.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> {t("Sources")}
              </p>
              <ul className="space-y-1.5">
                {kpi.sources.map((s) => (
                  <li key={s.id} className="text-sm flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    {s.name.startsWith("http") ? (
                      <a href={s.name} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{s.name}</a>
                    ) : (
                      <span className="text-slate-700">{s.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kpi.description && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("Description")}</p>
              <p className="text-sm leading-relaxed text-slate-700">{kpi.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== ONBOARD DIALOG ====================

function OnboardDialog({ open, onClose, vendor, onSuccess }: {
  open: boolean;
  onClose: () => void;
  vendor: TPRMMonitoringVendor | null;
  onSuccess: (monitoringVendorId: string, newTprmVendorId: string) => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", contactEmail: "", serviceCategory: "", vrr: "" });

  useEffect(() => {
    if (vendor) setForm({ name: vendor.vendorName, contactEmail: "", serviceCategory: "", vrr: "" });
  }, [vendor]);

  const handleSubmit = async () => {
    if (!vendor || !form.name.trim()) return;
    setSaving(true);
    try {
      const createRes = await fetch("/api/tprm/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contactEmail: form.contactEmail.trim() || null,
          serviceCategory: form.serviceCategory || null,
          vrr: form.vrr || null,
          status: "Onboarding",
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        toast({ title: t("Error"), description: err.error || t("Failed to create vendor"), variant: "destructive" });
        return;
      }
      const { data: newVendor } = await createRes.json();
      const linkRes = await fetch("/api/tprm/monitoring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vendor.id, tprmVendorId: newVendor.id }),
      });
      if (!linkRes.ok) {
        toast({ title: t("Warning"), description: t("Vendor created but linking failed"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: `${form.name} ${t("has been onboarded to TPRM Vendor Management")}` });
      onSuccess(vendor.id, newVendor.id);
      onClose();
    } catch {
      toast({ title: t("Error"), description: t("Failed to onboard vendor"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("Onboard to TPRM")}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>{t("Vendor Name")} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>{t("Contact Email")}</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="vendor@example.com" /></div>
          <div><Label>{t("Service Category")}</Label><Input value={form.serviceCategory} onChange={(e) => setForm({ ...form, serviceCategory: e.target.value })} placeholder={t("e.g. Cloud Infrastructure")} /></div>
          <div>
            <Label>{t("Vendor Risk Rating")}</Label>
            <Select value={form.vrr || "none"} onValueChange={(v) => setForm({ ...form, vrr: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder={t("Select rating")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("None")}</SelectItem>
                {["Critical", "High", "Moderate", "Low", "Nominal"].map((r) => <SelectItem key={r} value={r}>{t(r)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t("Cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.name.trim()}>
            {saving ? t("Onboarding...") : t("Onboard Vendor")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN DETAIL PAGE ====================

export default function MonitoringDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<TPRMMonitoringVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardDialogOpen, setOnboardDialogOpen] = useState(false);
  const [expandedKpis, setExpandedKpis] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tprm/monitoring?vendorId=${vendorId}`);
      if (res.ok) {
        const json = await res.json();
        setVendor(json.data || null);
      } else {
        toast({ title: t("Error"), description: t("Failed to load vendor data"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Network error"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [vendorId, toast, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOnboardSuccess = (monitoringVendorId: string, newTprmVendorId: string) => {
    if (vendor?.id === monitoringVendorId) {
      setVendor({ ...vendor, vendorOnboarded: true, tprmVendorId: newTprmVendorId });
    }
  };

  const toggleKpi = (id: string) => {
    setExpandedKpis((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Derived data from latest assessment
  const assessment = vendor?.assessments[0] ?? null;

  const { spKpis, teKpis } = useMemo(() => {
    if (!assessment) return { spKpis: [], teKpis: [] };
    const sp: TPRMKPIDetail[] = [];
    const te: TPRMKPIDetail[] = [];
    for (const kpi of assessment.kpiDetails) {
      if (THREAT_EXPOSURE_KPIS.includes(kpi.kpiName)) te.push(kpi);
      else sp.push(kpi);
    }
    // Sort by the defined order
    sp.sort((a, b) => SECURITY_POSTURE_KPIS.indexOf(a.kpiName) - SECURITY_POSTURE_KPIS.indexOf(b.kpiName));
    te.sort((a, b) => THREAT_EXPOSURE_KPIS.indexOf(a.kpiName) - THREAT_EXPOSURE_KPIS.indexOf(b.kpiName));
    return { spKpis: sp, teKpis: te };
  }, [assessment]);

  // Radar chart data
  const spRadarData = useMemo(() =>
    spKpis.map((k) => ({ kpi: k.kpiName, score: k.securityScore ?? 0, fullMark: 100 })),
    [spKpis]
  );
  const teRadarData = useMemo(() =>
    teKpis.map((k) => ({ kpi: k.kpiName, score: k.securityScore ?? 0, fullMark: 100 })),
    [teKpis]
  );

  // All vulnerabilities across KPIs
  const allVulnerabilities = useMemo(() => {
    if (!assessment) return [];
    return assessment.kpiDetails.flatMap((k) =>
      k.vulnerabilities.map((v) => ({ ...v, kpiName: k.kpiName }))
    );
  }, [assessment]);

  const vulnCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const v of allVulnerabilities) {
      const s = (v.severity || "").toLowerCase();
      if (s === "critical") counts.critical++;
      else if (s === "high") counts.high++;
      else if (s === "medium") counts.medium++;
      else counts.low++;
    }
    return counts;
  }, [allVulnerabilities]);

  // All recommendations (assessment-level + KPI-level)
  const allRecommendations = useMemo(() => {
    if (!assessment) return [];
    const recs: string[] = [];
    if (assessment.recommendation?.statement) recs.push(assessment.recommendation.statement);
    for (const kpi of assessment.kpiDetails) {
      if (kpi.recommendation) recs.push(kpi.recommendation);
    }
    return recs;
  }, [assessment]);

  // History data for chart
  const historyData = useMemo(() => {
    if (!vendor) return [];
    return [...vendor.assessments].reverse().map((a) => ({
      date: fmtShortDate(a.lastScan || a.createdAt),
      overallScore: a.overallScore,
      securityPosture: a.securityPostureScore,
      threatExposure: a.threatExposureScore,
    }));
  }, [vendor]);

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!vendor || !assessment) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/tprm/monitoring")} className="mb-4">
          <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Back")}
        </Button>
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-white">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{t("Vendor not found")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Button variant="default" size="sm" onClick={() => router.push("/tprm/monitoring")}
          className="bg-teal-700 hover:bg-teal-800 text-white h-7 px-3">
          <ArrowLeft className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Back")}
        </Button>
        <span className="text-muted-foreground">{t("Continuous Monitoring")}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">{t("Detailed Vendor Page")}</span>
      </div>

      {/* Header Card */}
      <div className="border rounded-lg bg-white p-6">
        <div className="flex items-start gap-4">
          <ScoreCircle score={assessment.overallScore} size={64} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{vendor.vendorName}</h1>
              {assessment.status && (
                <Badge className="bg-green-100 text-green-800 text-xs">{assessment.status}</Badge>
              )}
            </div>
            <a href={vendor.vendorURL} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5">
              <ExternalLink className="h-3 w-3" /> {vendor.vendorURL}
            </a>
            <p className="text-xs text-muted-foreground mt-1">
              {t("Scanned on")} {fmtDate(assessment.lastScan || assessment.createdAt)}
            </p>
            {/* Score pills */}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center border rounded-full px-3 py-1 gap-2">
                <span className="text-xs text-muted-foreground">{t("Security Posture Score")}</span>
                <span className="text-lg font-bold text-slate-800">
                  {assessment.securityPostureScore != null ? assessment.securityPostureScore.toFixed(2) : "\u2014"}
                </span>
              </div>
              <div className="flex items-center border rounded-full px-3 py-1 gap-2">
                <span className="text-xs text-muted-foreground">{t("Threat Exposure Score")}</span>
                <span className="text-lg font-bold text-slate-800">
                  {assessment.threatExposureScore != null ? assessment.threatExposureScore.toFixed(2) : "\u2014"}
                </span>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {vendor.vendorOnboarded ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Onboarded")}
              </Badge>
            ) : (
              <Button size="sm" onClick={() => setOnboardDialogOpen(true)}
                className="bg-teal-700 hover:bg-teal-800 text-white">
                <UserPlus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Onboard Vendor")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="risk" className="space-y-4">
        <div className="border-b">
          <TabsList className="bg-transparent h-auto p-0 gap-0">
            {[
              { value: "risk", label: t("Risk Analysis") },
              { value: "vulnerabilities", label: t("Vulnerabilities") },
              { value: "recommendations", label: t("Recommendations") },
              { value: "headers", label: t("HTTP Headers") },
              { value: "history", label: t("History") },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ==================== RISK ANALYSIS TAB ==================== */}
        <TabsContent value="risk" className="space-y-6 mt-0">
          {/* AI-Generated Summary */}
          {assessment.overallSummary && (
            <div className="border rounded-lg p-5 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-semibold text-sm">{t("AI-Generated Summary")}</span>
                <Badge variant="outline" className="text-xs text-teal-700 border-teal-300 bg-teal-50">
                  Powered by VerifAI
                </Badge>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{assessment.overallSummary}</p>
            </div>
          )}

          {/* Radar Charts */}
          {(spRadarData.length > 0 || teRadarData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Security Posture Radar */}
              {spRadarData.length > 0 && (
                <div className="border rounded-lg bg-white p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{t("Security Posture")}</span>
                    <span className={`text-2xl font-bold ${scoreColor(assessment.securityPostureScore) === "#16a34a" ? "text-green-600" : scoreColor(assessment.securityPostureScore) === "#ca8a04" ? "text-yellow-600" : "text-red-600"}`}>
                      {assessment.securityPostureScore ?? "\u2014"}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={spRadarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} />
                      <Radar dataKey="score" stroke="#0d9488" fill="#0d9488" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Threat Exposure Radar */}
              {teRadarData.length > 0 && (
                <div className="border rounded-lg bg-white p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{t("Threat Exposure")}</span>
                    <span className={`text-2xl font-bold ${scoreColor(assessment.threatExposureScore) === "#16a34a" ? "text-green-600" : scoreColor(assessment.threatExposureScore) === "#ca8a04" ? "text-yellow-600" : "text-red-600"}`}>
                      {assessment.threatExposureScore ?? "\u2014"}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={teRadarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 10, fill: "#64748b" }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} />
                      <Radar dataKey="score" stroke="#d97706" fill="#d97706" fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* KPI Details */}
          <div>
            <h3 className="font-semibold text-base mb-4">{t("KPI Details")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...spKpis, ...teKpis].map((kpi) => (
                <KpiCard
                  key={kpi.id}
                  kpi={kpi}
                  isThreat={THREAT_EXPOSURE_KPIS.includes(kpi.kpiName)}
                  expanded={expandedKpis.has(kpi.id)}
                  onToggle={() => toggleKpi(kpi.id)}
                  t={t}
                />
              ))}
            </div>
            {assessment.kpiDetails.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("No KPI data available")}</p>
            )}
          </div>
        </TabsContent>

        {/* ==================== VULNERABILITIES TAB ==================== */}
        <TabsContent value="vulnerabilities" className="mt-0">
          <div className="border rounded-lg bg-white">
            {allVulnerabilities.length > 0 ? (
              <>
                {/* Summary bar */}
                <div className="px-5 py-4 border-b bg-slate-50 rounded-t-lg">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-semibold">{t("Total CVEs")} = {allVulnerabilities.length}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" /> <span className="text-red-700">Critical = {vulnCounts.critical}</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400" /> <span className="text-orange-700">High = {vulnCounts.high}</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-400" /> <span className="text-yellow-700">Medium = {vulnCounts.medium}</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400" /> <span className="text-blue-700">Low = {vulnCounts.low}</span></span>
                  </div>
                </div>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-5 py-3 font-semibold text-slate-700">{t("CVE ID")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700">{t("Severity")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700">{t("Affected Component")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700">{t("Description")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allVulnerabilities.map((v, i) => (
                        <tr key={v.id || i} className="border-b last:border-b-0 hover:bg-slate-50/50">
                          <td className="px-5 py-3 text-primary font-mono text-xs">{v.cveId || "\u2014"}</td>
                          <td className="px-5 py-3">
                            {v.severity ? (
                              <Badge className={`text-xs ${severityBadgeClass(v.severity)}`}>{v.severity.toLowerCase()}</Badge>
                            ) : "\u2014"}
                          </td>
                          <td className="px-5 py-3 text-slate-600 text-center">{v.affectedComponent || "\u2014"}</td>
                          <td className="px-5 py-3 text-slate-600 max-w-[400px]">{v.description || "\u2014"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-2.5 border-t text-xs text-muted-foreground text-right">
                  1 to {allVulnerabilities.length} of {allVulnerabilities.length}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">{t("No vulnerability data available")}</p>
            )}
          </div>
        </TabsContent>

        {/* ==================== RECOMMENDATIONS TAB ==================== */}
        <TabsContent value="recommendations" className="mt-0">
          <div className="border rounded-lg bg-white p-6">
            {allRecommendations.length > 0 ? (
              <div className="space-y-5">
                {allRecommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span className="text-lg font-bold text-teal-700 min-w-[28px] text-right">{i + 1}</span>
                    <p className="text-sm text-slate-700 leading-relaxed pt-0.5">{rec}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t("No recommendations available")}</p>
            )}
          </div>
        </TabsContent>

        {/* ==================== HTTP HEADERS TAB ==================== */}
        <TabsContent value="headers" className="mt-0">
          <div className="border rounded-lg bg-white">
            {assessment.httpHeaders.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-4 py-3 font-semibold text-slate-700 w-16">{t("Sr No")}</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">{t("Name")}</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">{t("Value")}</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 text-center w-20">{t("Present")}</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">{t("Description")}</th>
                        <th className="px-4 py-3 font-semibold text-slate-700">{t("Recommendation")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.httpHeaders.map((hdr, i) => (
                        <tr key={hdr.id} className="border-b last:border-b-0 hover:bg-slate-50/50 align-top">
                          <td className="px-4 py-3 text-center text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{hdr.name}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs font-mono max-w-[220px] break-all">
                            {hdr.value || (hdr.present ? "\u2014" : "Not Present")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hdr.present
                              ? <span className="text-green-600 font-medium">{t("Yes")}</span>
                              : <span className="text-red-500 font-medium">{t("No")}</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs max-w-[250px]">{hdr.description || "\u2014"}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs max-w-[250px]">{hdr.recommendation || "\u2014"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 border-t text-xs text-muted-foreground text-right">
                  1 to {assessment.httpHeaders.length} of {assessment.httpHeaders.length}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">{t("No HTTP header data available")}</p>
            )}
          </div>
        </TabsContent>

        {/* ==================== HISTORY TAB ==================== */}
        <TabsContent value="history" className="space-y-6 mt-0">
          {/* Assessment history table */}
          <div className="border rounded-lg bg-white">
            {vendor.assessments.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-5 py-3 font-semibold text-slate-700">{t("Date")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700 text-center">{t("Score")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700 text-center">{t("Active")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendor.assessments.map((a) => (
                        <tr key={a.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                          <td className="px-5 py-3 text-primary">{fmtDate(a.lastScan || a.createdAt)}</td>
                          <td className="px-5 py-3 text-center font-bold">{a.overallScore ?? "\u2014"}</td>
                          <td className="px-5 py-3 text-center">
                            {a.isLatest
                              ? <span className="text-green-600 font-medium">{t("Active")}</span>
                              : <span className="text-muted-foreground">{t("Inactive")}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-2.5 border-t text-xs text-muted-foreground text-right">
                  1 to {vendor.assessments.length} of {vendor.assessments.length}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t("No history available")}</p>
            )}
          </div>

          {/* Trend Chart */}
          {historyData.length > 1 && (
            <div className="border rounded-lg bg-white p-5">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} label={{ value: t("Date"), position: "insideBottom", offset: -5, fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: t("Score"), angle: -90, position: "insideLeft", fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="overallScore" name={t("Overall Score")} stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="threatExposure" name={t("Threat Exposure Score")} stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="securityPosture" name={t("Security Posture Score")} stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Onboard Dialog */}
      <OnboardDialog
        open={onboardDialogOpen}
        onClose={() => setOnboardDialogOpen(false)}
        vendor={vendor}
        onSuccess={handleOnboardSuccess}
      />
    </div>
  );
}
