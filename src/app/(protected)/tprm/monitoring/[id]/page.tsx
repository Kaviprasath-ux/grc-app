"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  Activity,
  AlertTriangle,
  UserPlus,
  CheckCircle2,
  Loader2,
  X,
  Plus,
  Check,
  Info,
  Building2,
  Globe,
  Server,
  RefreshCw,
  Monitor,
  Fingerprint,
  Code,
  BarChart3,
  Mail,
  Lock,
  Eye,
  ShieldAlert,
  Radio,
  FileWarning,
  Users,
  Sparkles,
  Target,
  Layers,
  Zap,
  Scale,
  FileCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useHasPermission } from "@/hooks/usePermissions";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

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
interface AccountManager { name: string; email: string; contactNo: string }
interface ProfileField { id: string; fieldName: string; isSystem: boolean; isActive: boolean }
interface OnboardingQuestion {
  id: string; title: string; question: string | null; score: number;
  questionType: string; parentId: string | null; responseType: string;
  isActive: boolean; children: OnboardingQuestion[];
}
interface TemplateQuestion {
  id: string; questionId: string; sortOrder: number;
  question: { id: string; questionText: string; domain: { id: string; name: string } | null };
}
interface QuestionnaireTemplate {
  id: string; templateName: string; frameworkName: string | null;
  templateCategory: string; imageUrl: string | null;
  masterQuestionLinks: TemplateQuestion[];
}

// ==================== ONBOARD CONSTANTS ====================

const DEFAULT_SERVICE_CATEGORIES = [
  "IT Services", "Cloud Infrastructure", "Software Development", "Consulting",
  "Data Analytics", "Cybersecurity", "Managed Services", "Telecommunications",
  "Hardware Supply", "Business Process Outsourcing", "Financial Services",
  "Legal Services", "Marketing Services", "HR Services", "Logistics", "Other",
];
const emptyManager: AccountManager = { name: "", email: "", contactNo: "" };
const VRR_COLORS: Record<string, string> = {
  Nominal: "#22c55e", Low: "#84cc16", Moderate: "#eab308", High: "#f97316", Critical: "#ef4444",
};

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
  if (score >= 80) return "#15803d"; // green-700
  if (score >= 65) return "#059669"; // emerald-600
  if (score >= 50) return "#ca8a04"; // yellow-600
  return "#ef4444"; // red-500
}

// Trust rating based on score — used for KPI card styling
function scoreRating(score: number | null): { bg: string; iconBg: string; numColor: string; label: string } {
  if (score === null) return { bg: "", iconBg: "bg-slate-50 text-slate-400", numColor: "text-slate-400", label: "N/A" };
  if (score >= 80) return { bg: "bg-green-50/70", iconBg: "bg-green-100 text-green-700", numColor: "text-green-700", label: "Excellent" };
  if (score >= 65) return { bg: "bg-emerald-50/50", iconBg: "bg-emerald-50 text-emerald-600", numColor: "text-emerald-600", label: "Good" };
  if (score >= 50) return { bg: "bg-yellow-50/60", iconBg: "bg-yellow-50 text-yellow-600", numColor: "text-yellow-600", label: "Average" };
  return { bg: "bg-red-50/50", iconBg: "bg-red-50 text-red-500", numColor: "text-red-500", label: "Low" };
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
        {score != null ? Math.round(score) : "\u2014"}
      </text>
    </svg>
  );
}

// ==================== KPI CARD ====================

// KPI → unique icon mapping
const KPI_ICON_MAP: Record<string, LucideIcon> = {
  "Network Security": Globe,
  "DNS Health": Server,
  "Patching Cadence": RefreshCw,
  "Endpoint Security": Monitor,
  "IP Reputation": Fingerprint,
  "Application Security": Code,
  "Cubit Score": BarChart3,
  "Email Security": Mail,
  "SSL/TLS Configuration": Lock,
  "Privacy": Eye,
  "Known Breach": ShieldAlert,
  "Hacker Chatter": Radio,
  "Information Leak": FileWarning,
  "Social Engineering": Users,
};

// Check if a KPI has any detail content worth showing
function kpiHasDetails(kpi: TPRMKPIDetail): boolean {
  return !!(kpi.summary || kpi.description || kpi.keyFindings.length > 0 || kpi.sources.length > 0);
}

function KpiCard({ kpi, isThreat, onSelect, t }: {
  kpi: TPRMKPIDetail;
  isThreat: boolean;
  onSelect: () => void;
  t: (s: string) => string;
}) {
  const Icon = KPI_ICON_MAP[kpi.kpiName] || Shield;
  const score = kpi.securityScore;
  const rating = scoreRating(score);
  const hasDetails = kpiHasDetails(kpi);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-shadow hover:shadow-md ${rating.bg} ${hasDetails ? "cursor-pointer" : ""}`}
      onClick={hasDetails ? onSelect : undefined}
    >
      <div className="px-4 py-3.5 flex items-center gap-3 select-none">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${rating.iconBg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-sm text-slate-800 block truncate">{kpi.kpiName}</span>
          {hasDetails ? (
            <span className="text-[11px] text-slate-400">{t("Click for details")}</span>
          ) : (
            <span className={`text-[11px] font-medium ${rating.numColor}`}>{t(rating.label)}</span>
          )}
        </div>
        <span className={`text-2xl font-bold tabular-nums flex-shrink-0 ${rating.numColor}`}>
          {score ?? "\u2014"}
        </span>
      </div>
    </div>
  );
}

// KPI Detail Dialog
function KpiDetailDialog({ kpi, isThreat, open, onClose, t }: {
  kpi: TPRMKPIDetail | null;
  isThreat: boolean;
  open: boolean;
  onClose: () => void;
  t: (s: string) => string;
}) {
  if (!kpi) return null;
  const Icon = KPI_ICON_MAP[kpi.kpiName] || Shield;
  const score = kpi.securityScore;
  const rating = scoreRating(score);
  const categoryLabel = isThreat ? t("Threat Exposure") : t("Security Posture");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pr-8">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${rating.iconBg}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">{kpi.kpiName}</DialogTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{categoryLabel}</span>
                <span className={`text-xs font-semibold ${rating.numColor}`}>{t(rating.label)}</span>
              </div>
            </div>
            <span className={`text-3xl font-bold tabular-nums flex-shrink-0 ${rating.numColor}`}>
              {score ?? "\u2014"}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2 max-h-[60vh] overflow-y-auto">
          {kpi.summary && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t("Summary")}</p>
              <p className="text-sm leading-relaxed text-slate-600">{kpi.summary}</p>
            </div>
          )}
          {kpi.keyFindings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t("Key Findings")}</p>
              <ul className="space-y-1.5">
                {kpi.keyFindings.map((f) => (
                  <li key={f.id} className="text-sm flex items-start gap-2 text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                    {f.statement}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kpi.sources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t("Sources")}</p>
              <ul className="space-y-1">
                {kpi.sources.map((s) => (
                  <li key={s.id} className="text-sm flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    {s.name.startsWith("http") ? (
                      <a href={s.name} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{s.name}</a>
                    ) : (
                      <span className="text-slate-600">{s.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {kpi.description && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t("Description")}</p>
              <p className="text-sm leading-relaxed text-slate-600">{kpi.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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

  // Form state
  const [vendorName, setVendorName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [vendorUrl, setVendorUrl] = useState("");
  const [managers, setManagers] = useState<AccountManager[]>([{ ...emptyManager }]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [profileAnswers, setProfileAnswers] = useState<Record<string, string>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  // Config data
  const [rawServiceCategories, setRawServiceCategories] = useState<{ id: string; name: string }[]>([]);
  const { data: translatedServiceCategories } = useTranslatedData(rawServiceCategories, { modelName: 'TPRMServiceCategory' });
  const serviceCategories = useMemo(() => {
    if (translatedServiceCategories.length > 0) return translatedServiceCategories.map((c) => c.name);
    if (rawServiceCategories.length > 0) return rawServiceCategories.map((c) => c.name);
    return DEFAULT_SERVICE_CATEGORIES;
  }, [translatedServiceCategories, rawServiceCategories]);
  const [customProfileFields, setCustomProfileFields] = useState<ProfileField[]>([]);
  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>([]);
  const [ddConfig, setDdConfig] = useState<{ category: string; vrr: number; cadenceMonths?: number }[]>([]);

  // Post-create popup state
  const [createdVendorId, setCreatedVendorId] = useState<string | null>(null);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showRiskRatingDialog, setShowRiskRatingDialog] = useState(false);
  const [riskRatingVendor, setRiskRatingVendor] = useState<{ id: string; name: string; vrr: string | null } | null>(null);
  const [riskRatingLoading, setRiskRatingLoading] = useState(false);
  const [rawQuestionnaireTemplates, setRawQuestionnaireTemplates] = useState<QuestionnaireTemplate[]>([]);
  const { data: questionnaireTemplates } = useTranslatedData(rawQuestionnaireTemplates, { modelName: 'TPRMQuestionnaireTemplate' });
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [initiatingAssessment, setInitiatingAssessment] = useState(false);

  // VRR helpers
  const vrrLevels = useMemo(() => {
    const sorted = [...ddConfig].sort((a, b) => a.vrr - b.vrr);
    if (sorted.length < 5) {
      return [
        { name: "Nominal", min: 0, max: 19, color: "#22c55e" },
        { name: "Low", min: 20, max: 29, color: "#84cc16" },
        { name: "Moderate", min: 30, max: 39, color: "#eab308" },
        { name: "High", min: 40, max: 49, color: "#f97316" },
        { name: "Critical", min: 50, max: 100, color: "#ef4444" },
      ];
    }
    return sorted.map((item, idx) => ({
      name: item.category,
      min: item.vrr,
      max: idx < sorted.length - 1 ? sorted[idx + 1].vrr - 1 : 100,
      color: VRR_COLORS[item.category] || "#94a3b8",
    }));
  }, [ddConfig]);

  const parseVrrScore = (vrr: string | null): number => {
    if (!vrr) return 0;
    const num = parseFloat(vrr);
    if (!isNaN(num)) return Math.min(100, Math.max(0, num));
    const level = vrrLevels.find((l) => l.name.toLowerCase() === vrr.toLowerCase());
    if (level) return level.min;
    return 0;
  };

  const getVrrLevel = (score: number) => [...vrrLevels].reverse().find((l) => score >= l.min) || vrrLevels[0];

  const calculateVrrScore = (): number => {
    let total = 0;
    for (const q of onboardingQuestions) {
      if (questionAnswers[q.id] === "Yes") {
        total += q.score || 0;
      }
      if (q.children && questionAnswers[q.id] === "Yes") {
        for (const child of q.children) {
          if (child.isActive && questionAnswers[child.id] === "Yes") {
            total += child.score || 0;
          }
        }
      }
    }
    return total;
  };

  // Convert a cadence (in months) to a human phrase. Returns "" when no
  // periodic reassessment is configured so the caller can omit that sentence.
  const formatCadence = (months: number | undefined): string => {
    if (!months || months <= 0) return "";
    if (months % 12 === 0) {
      const years = months / 12;
      return years === 1 ? t("1 year") : `${years} ${t("years")}`;
    }
    return `${months} ${months === 1 ? t("month") : t("months")}`;
  };

  const getVrrDescription = (levelName: string) => {
    if (levelName === "Nominal") {
      return t("This vendor is nominal risk and hence there is no further due-diligence required. Please proceed with contracting.");
    }
    const cadenceMonths = ddConfig.find((d) => d.category === levelName)?.cadenceMonths;
    const cadenceText = formatCadence(cadenceMonths);
    const levelWord = t(levelName).toLowerCase();
    if (cadenceText) {
      return `${t("The inherent risk of this service is")} ${levelWord}. ${t("A due-diligence assessment is required before onboarding this vendor and a periodic assessment after every")} ${cadenceText}.`;
    }
    return `${t("The inherent risk of this service is")} ${levelWord}. ${t("A due-diligence assessment is required before onboarding this vendor.")}`;
  };

  // Load config on open
  useEffect(() => {
    if (!open) return;
    setVendorName(vendor?.vendorName || "");
    setServiceCategory("");
    setServiceDescription("");
    setVendorUrl(vendor?.vendorURL || "");
    setManagers([{ ...emptyManager }]);
    setFormErrors({});
    setProfileAnswers({});
    setQuestionAnswers({});
    setCreatedVendorId(null);
    setShowInfoPopup(false);
    setShowSuccessPopup(false);
    setShowRiskRatingDialog(false);

    (async () => {
      try {
        const [catRes, fieldRes, qRes, ccRes] = await Promise.all([
          fetch("/api/tprm/configurations/service-categories"),
          fetch("/api/tprm/configurations/vendor-profile-fields"),
          fetch("/api/tprm/configurations/onboarding-questions"),
          fetch("/api/tprm/control-center"),
        ]);
        if (catRes.ok) {
          const data = await catRes.json();
          if (Array.isArray(data) && data.length > 0) setRawServiceCategories(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        }
        if (fieldRes.ok) {
          const fields: ProfileField[] = await fieldRes.json();
          setCustomProfileFields(fields.filter((f) => !f.isSystem && f.isActive));
        }
        if (qRes.ok) {
          const questions: OnboardingQuestion[] = await qRes.json();
          setOnboardingQuestions(questions.filter((q) => q.isActive && q.questionType === "Parent"));
        }
        if (ccRes.ok) {
          const cc = await ccRes.json();
          setDdConfig(cc.dueDiligence || []);
        }
      } catch { /* silently fall back to defaults */ }
    })();
  }, [open, vendor]);

  // Form helpers
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!vendorName.trim()) errors.vendorName = t("Vendor name is required");
    managers.forEach((m, i) => {
      if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) errors[`manager_${i}_email`] = t("Invalid email format");
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateManager = (index: number, field: keyof AccountManager, value: string) => {
    setManagers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async () => {
    if (!vendor || !validateForm()) return;
    setSaving(true);
    try {
      const names = managers.map((m) => m.name).filter(Boolean);
      const emails = managers.map((m) => m.email).filter(Boolean);
      const phones = managers.map((m) => m.contactNo).filter(Boolean);
      const createRes = await fetch("/api/tprm/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vendorName.trim(),
          accountManagerName: names.join("; ") || null,
          accountManagerEmail: emails.join("; ") || null,
          contactPhone: phones.join("; ") || null,
          serviceCategory: serviceCategory || null,
          serviceDescription: serviceDescription || null,
          vendorUrl: vendorUrl.trim() || null,
          status: "Onboarding",
          onboardingAnswers: questionAnswers,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        toast({ title: t("Error"), description: err.error || t("Failed to create vendor"), variant: "destructive" });
        return;
      }
      const created = await createRes.json();
      const newVendorId = created.data?.id || created.id;

      // Calculate and save VRR as its categorical label (High/Moderate/Low/…)
      // so the Vendor Inventory renders the badge consistently across entry
      // points. Saving the raw numeric score leaked "40"-style badges.
      const vrrScore = calculateVrrScore();
      const vrrLabel = getVrrLevel(vrrScore).name;
      await fetch(`/api/tprm/vendors/${newVendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vrr: vrrLabel }),
      });

      // Link monitoring vendor to TPRM vendor
      const linkRes = await fetch("/api/tprm/monitoring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vendor.id, tprmVendorId: newVendorId }),
      });
      if (!linkRes.ok) {
        toast({ title: t("Warning"), description: t("Vendor created but linking failed"), variant: "destructive" });
      }

      // Trigger dynamic translation for the newly created vendor
      triggerTranslation('TPRMVendor', newVendorId, {
        name: vendorName.trim(),
        serviceCategory: serviceCategory || undefined,
      });

      setCreatedVendorId(newVendorId);
      onSuccess(vendor.id, newVendorId);
      onClose();
      setShowInfoPopup(true);
    } catch {
      toast({ title: t("Error"), description: t("Failed to onboard vendor"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckRiskRating = async () => {
    if (!createdVendorId) return;
    setShowSuccessPopup(false);
    setRiskRatingLoading(true);
    setShowRiskRatingDialog(true);
    setSelectedTemplateIds([]);
    try {
      const [vendorRes, templatesRes] = await Promise.all([
        fetch(`/api/tprm/vendors/${createdVendorId}`),
        fetch("/api/tprm/master-data/questionnaires"),
      ]);
      if (vendorRes.ok) setRiskRatingVendor(await vendorRes.json());
      if (templatesRes.ok) {
        const templates: QuestionnaireTemplate[] = await templatesRes.json();
        setRawQuestionnaireTemplates(templates.filter((tpl) => tpl.templateName));
        setSelectedTemplateIds(templates.filter((tpl) => tpl.templateName).map((tpl) => tpl.id));
      }
    } catch {
      toast({ title: t("Failed to fetch vendor data"), variant: "destructive" });
    } finally {
      setRiskRatingLoading(false);
    }
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) => prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]);
  };

  const handleInitiateAssessment = async () => {
    const targetVendorId = riskRatingVendor?.id || createdVendorId;
    if (!targetVendorId || selectedTemplateIds.length === 0) {
      toast({ title: t("Please select at least one questionnaire template"), variant: "destructive" });
      return;
    }
    setInitiatingAssessment(true);
    try {
      const selectedNames = questionnaireTemplates
        .filter((tmpl) => selectedTemplateIds.includes(tmpl.id))
        .map((tmpl) => tmpl.templateName)
        .join(", ");
      const res = await fetch("/api/tprm/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: targetVendorId,
          assessmentType: "Onboarding Assessment",
          questionnaireTemplate: selectedNames,
          status: "Draft",
        }),
      });
      if (res.ok) {
        const assessmentData = await res.json();
        const assessmentId = assessmentData?.data?.id || assessmentData?.id;
        if (assessmentId) {
          triggerTranslation('TPRMAssessment', assessmentId, {
            questionnaireTemplate: selectedNames,
          });
        }
        toast({ title: t("Assessment initiated successfully") });
        setShowRiskRatingDialog(false);
        setRiskRatingVendor(null);
        setSelectedTemplateIds([]);
      } else {
        const err = await res.json();
        toast({ title: t("Failed to initiate assessment"), description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to initiate assessment"), variant: "destructive" });
    } finally {
      setInitiatingAssessment(false);
    }
  };

  // ── Form fields JSX ──
  const formFields = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
      {/* Vendor Name */}
      <div className="space-y-1.5">
        <Label>{t("Vendor Name")} *</Label>
        <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={t("Enter vendor name")} />
        {formErrors.vendorName && <p className="text-xs text-red-500">{formErrors.vendorName}</p>}
      </div>

      {/* Account Managers */}
      {managers.map((manager, index) => (
        <div key={index} className="space-y-3 border rounded-md p-3 relative">
          {index > 0 && (
            <Button type="button" variant="ghost" size="icon" className="absolute top-1 ltr:right-1 rtl:left-1 h-6 w-6" onClick={() => { if (managers.length > 1) setManagers((prev) => prev.filter((_, i) => i !== index)); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>{t("Account Manager Name")}</Label>
              <Input value={manager.name} onChange={(e) => updateManager(index, "name", e.target.value)} placeholder={t("Enter account manager name")} />
            </div>
            {index === 0 && (
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setManagers((prev) => [...prev, { ...emptyManager }])}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("Account Manager Email")}</Label>
            <Input type="email" value={manager.email} onChange={(e) => updateManager(index, "email", e.target.value)} placeholder={t("Enter account manager email")} />
            {formErrors[`manager_${index}_email`] && <p className="text-xs text-red-500">{formErrors[`manager_${index}_email`]}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t("Contact Number")}</Label>
            <Input value={manager.contactNo} onChange={(e) => updateManager(index, "contactNo", e.target.value)} placeholder={t("e.g. +0919898989898")} />
          </div>
        </div>
      ))}

      {/* Service Category */}
      <div className="space-y-1.5">
        <Label>{t("Service Category")}</Label>
        <Select value={serviceCategory} onValueChange={setServiceCategory}>
          <SelectTrigger><SelectValue placeholder={t("Select category")} /></SelectTrigger>
          <SelectContent>
            {serviceCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>{t(cat)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Service Description */}
      <div className="space-y-1.5">
        <Label>{t("Service Description")}</Label>
        <Textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder={t("Describe the services provided")} rows={3} />
      </div>

      {/* Vendor URL */}
      <div className="space-y-1.5">
        <Label>{t("Vendor URL")}</Label>
        <Input value={vendorUrl} onChange={(e) => setVendorUrl(e.target.value)} placeholder={t("e.g. https://vendor-website.com")} />
      </div>

      {/* Custom Vendor Profile Fields */}
      {customProfileFields.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold text-muted-foreground">{t("Vendor Profile Fields")}</p>
          {customProfileFields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label>{field.fieldName}</Label>
              <Input
                value={profileAnswers[field.id] || ""}
                onChange={(e) => setProfileAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                placeholder={field.fieldName}
              />
            </div>
          ))}
        </div>
      )}

      {/* Onboarding Questions */}
      {onboardingQuestions.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold text-muted-foreground">{t("Onboarding Questions")}</p>
          {onboardingQuestions.map((q) => (
            <div key={q.id} className="space-y-2">
              <div className="space-y-1.5">
                <Label>{q.title}</Label>
                {q.responseType === "Yes/No" ? (
                  <div className="flex items-center gap-3">
                    <Button type="button" size="sm" variant={questionAnswers[q.id] === "Yes" ? "default" : "outline"}
                      className={questionAnswers[q.id] === "Yes" ? "bg-green-600 hover:bg-green-700" : ""}
                      onClick={() => setQuestionAnswers((prev) => ({ ...prev, [q.id]: "Yes" }))}>{t("Yes")}</Button>
                    <Button type="button" size="sm" variant={questionAnswers[q.id] === "No" ? "default" : "outline"}
                      className={questionAnswers[q.id] === "No" ? "bg-red-600 hover:bg-red-700" : ""}
                      onClick={() => setQuestionAnswers((prev) => ({ ...prev, [q.id]: "No" }))}>{t("No")}</Button>
                  </div>
                ) : (
                  <Input value={questionAnswers[q.id] || ""} onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))} placeholder={t("Enter your answer")} />
                )}
              </div>
              {/* Child questions */}
              {q.children && q.children.length > 0 && questionAnswers[q.id] === "Yes" && (
                <div className="ltr:ml-6 rtl:mr-6 space-y-2 border-l-2 ltr:pl-4 rtl:border-l-0 rtl:border-r-2 rtl:pr-4">
                  {q.children.filter((c) => c.isActive).map((child) => (
                    <div key={child.id} className="space-y-1.5">
                      <Label className="text-sm">{child.title}</Label>
                      {child.responseType === "Yes/No" ? (
                        <div className="flex items-center gap-3">
                          <Button type="button" size="sm" variant={questionAnswers[child.id] === "Yes" ? "default" : "outline"}
                            className={questionAnswers[child.id] === "Yes" ? "bg-green-600 hover:bg-green-700" : ""}
                            onClick={() => setQuestionAnswers((prev) => ({ ...prev, [child.id]: "Yes" }))}>{t("Yes")}</Button>
                          <Button type="button" size="sm" variant={questionAnswers[child.id] === "No" ? "default" : "outline"}
                            className={questionAnswers[child.id] === "No" ? "bg-red-600 hover:bg-red-700" : ""}
                            onClick={() => setQuestionAnswers((prev) => ({ ...prev, [child.id]: "No" }))}>{t("No")}</Button>
                        </div>
                      ) : (
                        <Input value={questionAnswers[child.id] || ""} onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [child.id]: e.target.value }))} placeholder={t("Enter your answer")} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Main Onboard Dialog */}
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Onboard to TPRM")}</DialogTitle></DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>{t("Cancel")}</Button>
            <Button onClick={handleSubmit} disabled={saving || !vendorName.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />} {t("Onboard Vendor")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Popup */}
      <Dialog open={showInfoPopup} onOpenChange={setShowInfoPopup}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary-600" />
            <DialogHeader><DialogTitle className="text-lg font-semibold">{t("Information")}</DialogTitle></DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-2">
            <p className="text-sm text-slate-700">{t("Your assessment for")} <strong>{vendorName}</strong> {t("is successfully queued.")}</p>
            <p className="text-sm text-slate-500">{t("You will be able to access the assessment once it is completed.")}</p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
            <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={() => { setShowInfoPopup(false); setShowSuccessPopup(true); }}>{t("OK")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Popup */}
      <Dialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader><DialogTitle className="text-lg font-semibold">{t("Success")}</DialogTitle></DialogHeader>
          </div>
          <div className="flex flex-col items-center px-6 py-8">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-base font-semibold text-slate-800 mb-1">{t("Your response has been successfully updated")}</p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
            <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={handleCheckRiskRating}>{t("Check Risk Rating")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk Rating Dialog */}
      <Dialog open={showRiskRatingDialog} onOpenChange={setShowRiskRatingDialog}>
        <DialogContent className="max-w-[90vw] lg:max-w-6xl p-0 gap-0 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{riskRatingVendor?.name || vendorName} - {t("Risk Rating")}</DialogTitle>
            </DialogHeader>
          </div>
          {riskRatingLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (() => {
            const vrrScore = parseVrrScore(riskRatingVendor?.vrr ?? null);
            const level = getVrrLevel(vrrScore);
            const cx = 150, cy = 140, r = 110;
            const arcSegments = vrrLevels.map((l, i) => ({
              from: l.min, to: i < vrrLevels.length - 1 ? vrrLevels[i + 1].min : 100, color: l.color,
            }));
            const scoreToXY = (s: number) => {
              const angle = (180 - (s * 180 / 100)) * Math.PI / 180;
              return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
            };
            const needleAngle = (180 - (vrrScore * 180 / 100)) * Math.PI / 180;
            const needleLen = r - 25;
            const nx = cx + needleLen * Math.cos(needleAngle);
            const ny = cy - needleLen * Math.sin(needleAngle);
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 max-h-[75vh] overflow-y-auto">
                {/* Left Column - Risk Rating */}
                <div className="px-6 py-6 space-y-5 lg:border-r border-slate-100">
                  <div className="flex justify-center">
                    <svg viewBox="0 0 300 175" className="w-full max-w-[280px]">
                      {arcSegments.map((seg) => {
                        const start = scoreToXY(seg.from);
                        const end = scoreToXY(seg.to);
                        const largeArc = (seg.to - seg.from) > 50 ? 1 : 0;
                        return (<path key={seg.from} d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`} fill="none" stroke={seg.color} strokeWidth={22} strokeLinecap="butt" />);
                      })}
                      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" />
                      <circle cx={cx} cy={cy} r={6} fill="#1e293b" />
                      <circle cx={cx} cy={cy} r={3} fill="#fff" />
                      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="28" fontWeight="bold" fill="#1e293b">{vrrScore}</text>
                      <text x={cx} y={cy + 48} textAnchor="middle" fontSize="12" fontWeight="600" fill={level.color}>{t(level.name)}</text>
                    </svg>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div className="flex-[20] bg-green-500" /><div className="flex-[10] bg-lime-500" /><div className="flex-[10] bg-yellow-500" /><div className="flex-[10] bg-orange-500" /><div className="flex-[50] bg-red-500" />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {vrrLevels.map((l) => (
                      <span key={l.name} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${level.name === l.name ? "ring-2 ring-offset-1 border-transparent text-white" : "bg-white text-slate-500 border-slate-200"}`}
                        style={level.name === l.name ? { backgroundColor: l.color, ["--tw-ring-color" as string]: l.color } : {}}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />{t(l.name)}
                      </span>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-800">{t("Vendor Risk Rating")}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{getVrrDescription(level.name)}</p>
                  </div>
                </div>

                {/* Right Column - Suggested Questionnaire */}
                <div className="px-6 py-6 space-y-5">
                  <h3 className="text-base font-semibold text-slate-800">{t("Suggested Questionnaire")}</h3>
                  {selectedTemplateIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 min-h-[44px]">
                      {questionnaireTemplates.filter((tmpl) => selectedTemplateIds.includes(tmpl.id)).map((tmpl) => (
                        <span key={tmpl.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 text-primary-800 text-xs font-medium">
                          {tmpl.templateName}
                          <button type="button" onClick={() => toggleTemplate(tmpl.id)} className="hover:text-primary-600"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {selectedTemplateIds.length > 0 && (() => {
                    const selectedTemplates = questionnaireTemplates.filter((tmpl) => selectedTemplateIds.includes(tmpl.id));
                    const allQuestions = selectedTemplates.flatMap((tmpl) => tmpl.masterQuestionLinks || []);
                    if (allQuestions.length === 0) return null;
                    return (
                      <div className="border border-slate-200 rounded-lg bg-white max-h-40 overflow-y-auto">
                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                          <span className="text-xs font-medium text-slate-600">{allQuestions.length} {allQuestions.length === 1 ? t("question") : t("questions")} {t("from")} {selectedTemplates.length} {selectedTemplates.length === 1 ? t("template") : t("templates")}</span>
                        </div>
                        <ul className="divide-y divide-slate-100">
                          {allQuestions.slice(0, 20).map((link, idx) => (
                            <li key={link.id} className="px-3 py-1.5 flex items-start gap-2">
                              <span className="text-[10px] text-slate-400 mt-0.5 shrink-0">{idx + 1}.</span>
                              <div className="min-w-0">
                                <p className="text-[11px] text-slate-700 line-clamp-1">{link.question.questionText}</p>
                                {link.question.domain && <span className="text-[10px] text-slate-400">{link.question.domain.name}</span>}
                              </div>
                            </li>
                          ))}
                          {allQuestions.length > 20 && <li className="px-3 py-1.5 text-[10px] text-slate-400 text-center">+{allQuestions.length - 20} {t("more")}...</li>}
                        </ul>
                      </div>
                    );
                  })()}
                  <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={handleInitiateAssessment} disabled={initiatingAssessment || selectedTemplateIds.length === 0}>
                    {initiatingAssessment && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}{t("Initiate Assessment")}
                  </Button>
                  {questionnaireTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Building2 className="h-8 w-8 mb-2" /><p className="text-sm">{t("No questionnaire templates available")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {questionnaireTemplates.map((tmpl) => {
                        const isSelected = selectedTemplateIds.includes(tmpl.id);
                        const qCount = tmpl.masterQuestionLinks?.length || 0;
                        return (
                          <button key={tmpl.id} type="button" onClick={() => toggleTemplate(tmpl.id)}
                            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center hover:shadow-sm ${isSelected ? "border-primary-500 bg-primary-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                            {isSelected && (
                              <div className="absolute top-1.5 ltr:right-1.5 rtl:left-1.5 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                              {tmpl.imageUrl ? <img src={tmpl.imageUrl} alt={tmpl.templateName} className="w-full h-full object-cover" /> : <Building2 className="h-7 w-7 text-slate-400" />}
                            </div>
                            <span className="text-xs font-medium text-slate-700 line-clamp-2">{tmpl.templateName}</span>
                            {tmpl.frameworkName && <span className="text-[10px] text-slate-500 line-clamp-1">{tmpl.frameworkName}</span>}
                            <span className="text-[10px] text-slate-400">{qCount} {qCount === 1 ? t("question") : t("questions")}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== MAIN DETAIL PAGE ====================

export default function MonitoringDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const canAccessConfig = useHasPermission("tprm.configurations", "view");
  const canOnboardVendor = useHasPermission("tprm.monitoring", "edit") || useHasPermission("tprm.bo-monitoring", "edit") || useHasPermission("tprm.rm-monitoring", "edit");
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<TPRMMonitoringVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardDialogOpen, setOnboardDialogOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<{ kpi: TPRMKPIDetail; isThreat: boolean } | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // History: selected assessment (null = latest)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  // Report Issue state
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [reportedFindingIds, setReportedFindingIds] = useState<Set<string>>(new Set());
  const [issueSaving, setIssueSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setConfigError(null);
    try {
      // Validate scorecard configuration is complete
      const [configRes, factorsRes] = await Promise.all([
        fetch("/api/tprm/configurations/scorecard-config"),
        fetch("/api/tprm/configurations/scorecard-factors"),
      ]);
      let valid = true;

      if (configRes.ok) {
        const cfg = await configRes.json();
        if (!cfg.scoringFormula || (cfg.securityPostureWeight ?? 0) + (cfg.threatExposureWeight ?? 0) !== 100) valid = false;
      } else {
        valid = false;
      }

      if (valid && factorsRes.ok) {
        const allFactors: { scoreType: string; isMandatory: boolean; weightage: number }[] = await factorsRes.json();
        const spTotal = allFactors.filter(f => f.scoreType === "SecurityPosture" && f.isMandatory).reduce((s, f) => s + f.weightage, 0);
        const teTotal = allFactors.filter(f => f.scoreType === "ThreatExposure" && f.isMandatory).reduce((s, f) => s + f.weightage, 0);
        if (spTotal !== 100 || teTotal !== 100) valid = false;
      } else if (valid) {
        valid = false;
      }

      if (!valid) {
        setConfigError(t("Scorecard configuration is incomplete. Please ensure scoring formula, weights, and mandatory factor weightages (100% each) are properly configured."));
        setLoading(false);
        return;
      }

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

  // Derived data from selected assessment (defaults to latest)
  const assessment = useMemo(() => {
    if (!vendor?.assessments.length) return null;
    if (selectedAssessmentId) {
      return vendor.assessments.find(a => a.id === selectedAssessmentId) ?? vendor.assessments[0];
    }
    return vendor.assessments[0];
  }, [vendor, selectedAssessmentId]);

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

  // Collect all key findings across KPIs for the report issue dialog (exclude already reported)
  const allFindings = useMemo(() => {
    if (!assessment) return [];
    return assessment.kpiDetails.flatMap(kpi =>
      kpi.keyFindings
        .filter(f => !reportedFindingIds.has(f.id))
        .map(f => ({
          findingId: f.id,
          statement: f.statement,
          kpiName: kpi.kpiName,
          severity: kpi.severity || null,
          score: kpi.securityScore,
          recommendation: kpi.recommendation || null,
        }))
    );
  }, [assessment, reportedFindingIds]);

  const toggleFinding = (findingId: string) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingId)) next.delete(findingId);
      else next.add(findingId);
      return next;
    });
  };

  const toggleAllFindings = () => {
    if (selectedFindings.size === allFindings.length) {
      setSelectedFindings(new Set());
    } else {
      setSelectedFindings(new Set(allFindings.map(f => f.findingId)));
    }
  };

  const handleReportIssues = async () => {
    if (selectedFindings.size === 0 || !vendor?.tprmVendorId) return;
    setIssueSaving(true);
    try {
      const findings = allFindings.filter(f => selectedFindings.has(f.findingId));
      const res = await fetch("/api/tprm/monitoring/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor.tprmVendorId,
          findings,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast({ title: t("Success"), description: `${data.count || findings.length} ${t("issue(s) reported successfully")}` });
      setReportedFindingIds(prev => {
        const next = new Set(prev);
        for (const f of findings) next.add(f.findingId);
        return next;
      });
      setSelectedFindings(new Set());
      setReportIssueOpen(false);
    } catch {
      toast({ title: t("Error"), description: t("Failed to report issues"), variant: "destructive" });
    } finally {
      setIssueSaving(false);
    }
  };

  // History data for chart
  const historyData = useMemo(() => {
    if (!vendor) return [];
    return [...vendor.assessments].reverse().map((a) => ({
      date: fmtShortDate(a.lastScan || a.createdAt),
      overallScore: a.calculatedOverallScore ?? a.overallScore,
      securityPosture: a.calculatedSecurityPosture ?? a.securityPostureScore,
      threatExposure: a.calculatedThreatExposure ?? a.threatExposureScore,
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

  if (configError) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/tprm/monitoring")} className="mb-4">
          <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Back")}
        </Button>
        <div className="text-center py-12 border rounded-lg bg-white">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500" />
          <p className="font-semibold text-lg mb-2">{t("Scorecard Configuration Incomplete")}</p>
          <div className="text-sm text-muted-foreground whitespace-pre-line mb-4">{configError}</div>
          {canAccessConfig ? (
            <Button onClick={() => router.push("/tprm/configurations")}>
              {t("Go to Scorecard Configuration")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("Please contact your administrator to complete the scorecard configuration.")}</p>
          )}
        </div>
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
          className="h-7 px-3">
          <ArrowLeft className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Back")}
        </Button>
        <span className="text-muted-foreground">{t("Continuous Monitoring")}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold">{t("Detailed Vendor Page")}</span>
      </div>

      {/* Historical assessment banner */}
      {!assessment.isLatest && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Info className="h-4 w-4" />
            <span>{t("Viewing historical assessment from")} <strong>{fmtDate(assessment.lastScan || assessment.createdAt)}</strong></span>
          </div>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelectedAssessmentId(null)}>
            {t("View Latest")}
          </Button>
        </div>
      )}

      {/* Header Card */}
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-5">
            <ScoreCircle score={assessment.calculatedOverallScore ?? assessment.overallScore} size={72} />
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
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {vendor.vendorOnboarded ? (
                <>
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle2 className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Onboarded")}
                  </Badge>
                  <Button size="sm" variant="destructive" onClick={() => setReportIssueOpen(true)}>
                    <AlertTriangle className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Report Issue")}
                  </Button>
                </>
              ) : canOnboardVendor ? (
                <Button size="sm" onClick={() => setOnboardDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Onboard Vendor")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        {/* Score strip */}
        <div className="border-t bg-slate-50/50 px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-xs text-muted-foreground">{t("Security Posture")}</span>
            <span className={`text-base font-bold tabular-nums ${scoreRating(assessment.calculatedSecurityPosture ?? assessment.securityPostureScore).numColor}`}>
              {(assessment.calculatedSecurityPosture ?? assessment.securityPostureScore) != null ? Math.round((assessment.calculatedSecurityPosture ?? assessment.securityPostureScore)!) : "\u2014"}
            </span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-muted-foreground">{t("Threat Exposure")}</span>
            <span className={`text-base font-bold tabular-nums ${scoreRating(assessment.calculatedThreatExposure ?? assessment.threatExposureScore).numColor}`}>
              {(assessment.calculatedThreatExposure ?? assessment.threatExposureScore) != null ? Math.round((assessment.calculatedThreatExposure ?? assessment.threatExposureScore)!) : "\u2014"}
            </span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("Overall")}</span>
            <span className={`text-base font-bold tabular-nums ${scoreRating(assessment.calculatedOverallScore ?? assessment.overallScore).numColor}`}>
              {(assessment.calculatedOverallScore ?? assessment.overallScore) != null ? Math.round((assessment.calculatedOverallScore ?? assessment.overallScore)!) : "\u2014"}
            </span>
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

          {/* ── Section 1: AI-Generated Summary ── */}
          {assessment.overallSummary && (
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-teal-50 to-white border-b flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <span className="font-semibold text-sm text-slate-800">{t("AI-Generated Summary")}</span>
                <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-300 bg-teal-50/80 ml-auto">
                  Powered by VerifAI
                </Badge>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-slate-600 leading-relaxed">{assessment.overallSummary}</p>
              </div>
            </div>
          )}

          {/* ── Section 2: Score Analysis (Radar Charts + Summaries) ── */}
          {(spRadarData.length > 0 || teRadarData.length > 0) && (
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white border-b flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Target className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <span className="font-semibold text-sm text-slate-800">{t("Score Analysis")}</span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Security Posture Radar */}
                  {spRadarData.length > 0 && (
                    <div className="border rounded-lg bg-slate-50/30 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-teal-500" />
                          <span className="font-semibold text-sm">{t("Security Posture")}</span>
                        </div>
                        <span className={`text-2xl font-bold tabular-nums ${scoreRating(assessment.calculatedSecurityPosture ?? assessment.securityPostureScore).numColor}`}>
                          {(assessment.calculatedSecurityPosture ?? assessment.securityPostureScore) != null ? Math.round((assessment.calculatedSecurityPosture ?? assessment.securityPostureScore)!) : "\u2014"}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={spRadarData} cx="50%" cy="50%" outerRadius="70%">
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 10, fill: "#64748b" }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} />
                          <Radar dataKey="score" stroke="#0d9488" fill="#0d9488" fillOpacity={0.25} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                      {assessment.securityPostureSummary && (
                        <p className="text-xs text-slate-500 leading-relaxed mt-2 px-1">{assessment.securityPostureSummary}</p>
                      )}
                    </div>
                  )}

                  {/* Threat Exposure Radar */}
                  {teRadarData.length > 0 && (
                    <div className="border rounded-lg bg-slate-50/30 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="font-semibold text-sm">{t("Threat Exposure")}</span>
                        </div>
                        <span className={`text-2xl font-bold tabular-nums ${scoreRating(assessment.calculatedThreatExposure ?? assessment.threatExposureScore).numColor}`}>
                          {(assessment.calculatedThreatExposure ?? assessment.threatExposureScore) != null ? Math.round((assessment.calculatedThreatExposure ?? assessment.threatExposureScore)!) : "\u2014"}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={teRadarData} cx="50%" cy="50%" outerRadius="70%">
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="kpi" tick={{ fontSize: 10, fill: "#64748b" }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} />
                          <Radar dataKey="score" stroke="#d97706" fill="#d97706" fillOpacity={0.2} strokeWidth={2} />
                        </RadarChart>
                      </ResponsiveContainer>
                      {assessment.threatExposureSummary && (
                        <p className="text-xs text-slate-500 leading-relaxed mt-2 px-1">{assessment.threatExposureSummary}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Section 3: Security Posture KPIs ── */}
          {spKpis.length > 0 && (
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-teal-50/60 to-white border-b flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Layers className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-sm text-slate-800">{t("Security Posture KPIs")}</span>
                  <span className="text-xs text-slate-400 ml-2">{spKpis.length} {t("indicators")}</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${scoreRating(assessment.calculatedSecurityPosture ?? assessment.securityPostureScore).numColor}`}>
                  {(assessment.calculatedSecurityPosture ?? assessment.securityPostureScore) != null ? Math.round((assessment.calculatedSecurityPosture ?? assessment.securityPostureScore)!) : "\u2014"}
                </span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {spKpis.map((kpi) => (
                    <KpiCard
                      key={kpi.id}
                      kpi={kpi}
                      isThreat={false}
                      onSelect={() => setSelectedKpi({ kpi, isThreat: false })}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Section 4: Threat Exposure KPIs ── */}
          {teKpis.length > 0 && (
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-amber-50/60 to-white border-b flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-sm text-slate-800">{t("Threat Exposure KPIs")}</span>
                  <span className="text-xs text-slate-400 ml-2">{teKpis.length} {t("indicators")}</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${scoreRating(assessment.calculatedThreatExposure ?? assessment.threatExposureScore).numColor}`}>
                  {(assessment.calculatedThreatExposure ?? assessment.threatExposureScore) != null ? Math.round((assessment.calculatedThreatExposure ?? assessment.threatExposureScore)!) : "\u2014"}
                </span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teKpis.map((kpi) => (
                    <KpiCard
                      key={kpi.id}
                      kpi={kpi}
                      isThreat={true}
                      onSelect={() => setSelectedKpi({ kpi, isThreat: true })}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {assessment.kpiDetails.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t("No KPI data available")}</p>
          )}

          {/* ── Section 5: Compliance & Legal (hidden for all roles) ── */}

          {/* KPI Detail Dialog */}
          <KpiDetailDialog
            kpi={selectedKpi?.kpi ?? null}
            isThreat={selectedKpi?.isThreat ?? false}
            open={!!selectedKpi}
            onClose={() => setSelectedKpi(null)}
            t={t}
          />
        </TabsContent>

        {/* ==================== VULNERABILITIES TAB ==================== */}
        <TabsContent value="vulnerabilities" className="mt-0">
          <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
            {allVulnerabilities.length > 0 ? (
              <>
                {/* Summary bar */}
                <div className="px-5 py-3.5 border-b bg-gradient-to-r from-red-50/60 to-white flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  </div>
                  <span className="font-semibold text-sm text-slate-800">{t("Vulnerabilities")}</span>
                  <span className="text-xs text-slate-400 ml-1">{allVulnerabilities.length} {t("total")}</span>
                  <div className="flex items-center gap-3 ml-auto text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> <span className="text-red-700">{vulnCounts.critical} Critical</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400" /> <span className="text-orange-700">{vulnCounts.high} High</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" /> <span className="text-yellow-700">{vulnCounts.medium} Medium</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-400" /> <span className="text-blue-700">{vulnCounts.low} Low</span></span>
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
          <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-50/60 to-white border-b flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="font-semibold text-sm text-slate-800">{t("Recommendations")}</span>
              {allRecommendations.length > 0 && (
                <span className="text-xs text-slate-400 ml-1">{allRecommendations.length} {t("items")}</span>
              )}
            </div>
            {allRecommendations.length > 0 ? (
              <div className="p-5 space-y-3">
                {allRecommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <p className="text-sm text-slate-700 leading-relaxed pt-1">{rec}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">{t("No recommendations available")}</p>
            )}
          </div>
        </TabsContent>

        {/* ==================== HTTP HEADERS TAB ==================== */}
        <TabsContent value="headers" className="mt-0">
          <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-purple-50/60 to-white border-b flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Globe className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <span className="font-semibold text-sm text-slate-800">{t("HTTP Security Headers")}</span>
              {assessment.httpHeaders.length > 0 && (
                <span className="text-xs text-slate-400 ml-1">{assessment.httpHeaders.length} {t("headers")}</span>
              )}
              {assessment.httpHeaders.length > 0 && (
                <div className="flex items-center gap-3 ml-auto text-xs">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    <span className="text-green-700">{assessment.httpHeaders.filter(h => h.present).length} {t("Present")}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <span className="text-red-600">{assessment.httpHeaders.filter(h => !h.present).length} {t("Missing")}</span>
                  </span>
                </div>
              )}
            </div>
            {assessment.httpHeaders.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left bg-slate-50/50">
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
                            {hdr.value || (hdr.present ? "\u2014" : <span className="text-red-400 italic">Not Present</span>)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hdr.present
                              ? <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">{t("Yes")}</Badge>
                              : <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">{t("No")}</Badge>
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
          <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50/60 to-white border-b flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="font-semibold text-sm text-slate-800">{t("Assessment History")}</span>
              {vendor.assessments.length > 0 && (
                <span className="text-xs text-slate-400 ml-1">{vendor.assessments.length} {t("assessments")}</span>
              )}
            </div>
            {vendor.assessments.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left bg-slate-50/50">
                        <th className="px-5 py-3 font-semibold text-slate-700">{t("Scan Date")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700 text-center">{t("Score")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700 text-center">{t("Status")}</th>
                        <th className="px-5 py-3 font-semibold text-slate-700 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendor.assessments.map((a) => {
                        const isSelected = selectedAssessmentId ? a.id === selectedAssessmentId : a.isLatest;
                        return (
                          <tr
                            key={a.id}
                            className={`border-b last:border-b-0 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-slate-50/50"}`}
                            onClick={() => { setSelectedAssessmentId(a.id); }}
                          >
                            <td className="px-5 py-3 text-slate-700">{fmtDate(a.lastScan || a.createdAt)}</td>
                            <td className="px-5 py-3 text-center">
                              <span className={`font-bold tabular-nums ${scoreRating(a.calculatedOverallScore ?? a.overallScore).numColor}`}>
                                {(a.calculatedOverallScore ?? a.overallScore) != null ? Math.round(a.calculatedOverallScore ?? a.overallScore ?? 0) : "\u2014"}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              {a.isLatest
                                ? <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">{t("Latest")}</Badge>
                                : <Badge variant="outline" className="text-xs text-slate-400">{fmtDate(a.createdAt)}</Badge>
                              }
                            </td>
                            <td className="px-5 py-3 text-center">
                              {isSelected && <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{t("Viewing")}</Badge>}
                            </td>
                          </tr>
                        );
                      })}
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
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white border-b flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <span className="font-semibold text-sm text-slate-800">{t("Score Trend")}</span>
              </div>
              <div className="p-5">
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={historyData} margin={{ bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} label={{ value: t("Date"), position: "insideBottom", offset: -5, fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: t("Score"), angle: -90, position: "insideLeft", fontSize: 12 }} />
                    <Tooltip />
                    <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 20 }} />
                    <Line type="monotone" dataKey="overallScore" name={t("Overall Score")} stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="threatExposure" name={t("Threat Exposure Score")} stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="securityPosture" name={t("Security Posture Score")} stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
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

      {/* Report Issue Dialog — Key Findings */}
      <Dialog open={reportIssueOpen} onOpenChange={(open) => { setReportIssueOpen(open); if (!open) setSelectedFindings(new Set()); }}>
        <DialogContent className="!max-w-3xl w-[95vw] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("Report Issue(s)")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("Select key findings to report as remediation issues.")}
          </p>
          {allFindings.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t("No key findings available in the current assessment.")}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b pb-2">
                <Checkbox
                  checked={selectedFindings.size === allFindings.length}
                  onCheckedChange={toggleAllFindings}
                  id="select-all-findings"
                />
                <label htmlFor="select-all-findings" className="text-sm font-medium cursor-pointer">
                  {t("Select All")} ({selectedFindings.size}/{allFindings.length})
                </label>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                {allFindings.map(f => (
                  <div
                    key={f.findingId}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedFindings.has(f.findingId) ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleFinding(f.findingId)}
                  >
                    <Checkbox
                      checked={selectedFindings.has(f.findingId)}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleFinding(f.findingId)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{f.kpiName}</Badge>
                        {f.severity && (
                          <Badge className={`text-xs ${
                            f.severity === "Critical" ? "bg-red-100 text-red-700" :
                            f.severity === "High" ? "bg-orange-100 text-orange-700" :
                            f.severity === "Medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                          }`}>{t(f.severity)}</Badge>
                        )}
                        {f.score != null && (
                          <Badge variant="outline" className="text-xs">{t("Score")}: {f.score}</Badge>
                        )}
                      </div>
                      <p className="text-sm">{f.statement}</p>
                      {f.recommendation && (
                        <p className="text-xs text-muted-foreground mt-1">{t("Recommendation")}: {f.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportIssueOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleReportIssues} disabled={issueSaving || selectedFindings.size === 0} variant="destructive">
              {issueSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Report Issue(s)")} {selectedFindings.size > 0 && `(${selectedFindings.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
