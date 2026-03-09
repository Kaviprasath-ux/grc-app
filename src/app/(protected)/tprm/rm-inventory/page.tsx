"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Home, ChevronRight, Search, Plus, Minus, Download, MoreHorizontal,
  Eye, Pencil, Trash2, Building2, Loader2, ChevronLeft, X, Check, Info, Play, AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────
interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  accountManagerName: string | null;
  accountManagerEmail: string | null;
  serviceCategory: string | null;
  serviceDescription: string | null;
  vendorUrl: string | null;
  status: string;
  vrr: string | null;
  engagementId: string | null;
  createdAt: string;
  department: { id: string; name: string } | null;
  _count?: { assessments: number };
}

interface VendorGroup {
  name: string;
  vrr: string | null;
  vendors: Vendor[];
}

interface AccountManager {
  name: string;
  email: string;
  contactNo: string;
}

interface ProfileField {
  id: string;
  fieldName: string;
  isSystem: boolean;
  isActive: boolean;
}

interface OnboardingQuestion {
  id: string;
  title: string;
  question: string | null;
  score: number;
  questionType: string;
  parentId: string | null;
  responseType: string;
  isActive: boolean;
  children: OnboardingQuestion[];
}

interface TemplateQuestion {
  id: string;
  questionId: string;
  sortOrder: number;
  question: {
    id: string;
    questionText: string;
    domain: { id: string; name: string } | null;
  };
}

interface QuestionnaireTemplate {
  id: string;
  templateName: string;
  frameworkName: string | null;
  templateCategory: string;
  imageUrl: string | null;
  masterQuestionLinks: TemplateQuestion[];
}

// ── Constants ──────────────────────────────────────────
const DEFAULT_SERVICE_CATEGORIES = [
  "IT Services", "Cloud Infrastructure", "Software Development", "Consulting",
  "Data Analytics", "Cybersecurity", "Managed Services", "Telecommunications",
  "Hardware Supply", "Business Process Outsourcing", "Financial Services",
  "Legal Services", "Marketing Services", "HR Services", "Logistics", "Other",
];
const STATUS_OPTIONS = ["Onboarding", "Onboarded", "Offboarding", "Offboarded"];
const ITEMS_PER_PAGE = 10;
const emptyManager: AccountManager = { name: "", email: "", contactNo: "" };
const VRR_COLORS: Record<string, string> = {
  Nominal: "#22c55e", Low: "#84cc16", Moderate: "#eab308", High: "#f97316", Critical: "#ef4444",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  Onboarding: "bg-blue-100 text-blue-800",
  Onboarded: "bg-green-100 text-green-800",
  Offboarding: "bg-yellow-100 text-yellow-800",
  Offboarded: "bg-slate-100 text-slate-600",
  Inactive: "bg-gray-100 text-gray-600",
};

// ── Vendor Accordion Item ───────────────────────────────────────────────────
function VendorAccordionItem({
  group, isExpanded, onToggle, onExport, onInitiateAssessment, onReportIssue, onRowClick, t,
}: {
  group: VendorGroup; isExpanded: boolean; onToggle: () => void;
  onExport: (v: Vendor) => void; onInitiateAssessment: (v: Vendor) => void;
  onReportIssue: (group: VendorGroup) => void; onRowClick: (v: Vendor) => void; t: (s: string) => string;
}) {
  // Use the highest VRR across all engagements for the group header
  const headerVrr = group.vrr;
  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      {/* Accordion Header */}
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left">
        <span className="font-medium text-sm text-slate-800">{group.name}{headerVrr ? ` - ${headerVrr}` : ""}</span>
        <span className="text-slate-500 flex-shrink-0">{isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
      </button>

      {/* Expanded Body */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          {/* Action buttons */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex-wrap">
            <Button size="sm" variant="default" onClick={() => onExport(group.vendors[0])}>
              <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t("Export")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onReportIssue(group)}>
              <AlertTriangle className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />{t("Report Issue")}
            </Button>
          </div>

          {/* DataGrid table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("Vendor Name")}</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("Engagement ID")}</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("Department")}</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("Service Category")}</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("Status")}</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("VRR")}</th>
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {group.vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer" onClick={() => onRowClick(vendor)}>
                    <td className="px-4 py-3 font-medium text-primary">{vendor.name}</td>
                    <td className="px-4 py-3 text-slate-600">{vendor.engagementId || vendor.vendorCode || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{vendor.department?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{vendor.serviceCategory || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_COLORS[vendor.status] || "bg-slate-100 text-slate-600"}`}>
                        {t(vendor.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {vendor.vrr
                        ? <span className="text-xs px-2 py-0.5 rounded font-medium text-white" style={{ backgroundColor: VRR_COLORS[vendor.vrr] || "#94a3b8" }}>{t(vendor.vrr)}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {vendor.vrr && vendor.vrr !== "Nominal" && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onInitiateAssessment(vendor); }}>
                          <Play className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
            {t("Showing")} 1–{group.vendors.length} {t("of")} {group.vendors.length}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RMInventoryPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const { canCreate, canEdit, canDelete, isLoading: permLoading } = usePermissions("tprm.rm-inventory");

  // ── List state ─────────────────────────────────────
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  // ── Dialog state ───────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [createdVendorName, setCreatedVendorName] = useState("");
  const [createdVendorId, setCreatedVendorId] = useState<string | null>(null);
  const [showRiskRatingDialog, setShowRiskRatingDialog] = useState(false);
  const [riskRatingVendor, setRiskRatingVendor] = useState<Vendor | null>(null);
  const [riskRatingLoading, setRiskRatingLoading] = useState(false);
  const [questionnaireTemplates, setQuestionnaireTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [initiatingAssessment, setInitiatingAssessment] = useState(false);

  // ── Report Issue dialog state ───────────────────
  const [showReportIssueDialog, setShowReportIssueDialog] = useState(false);
  const [reportIssueGroup, setReportIssueGroup] = useState<VendorGroup | null>(null);
  const [reportIssueTitle, setReportIssueTitle] = useState("");
  const [reportIssueDescription, setReportIssueDescription] = useState("");
  const [reportIssueSeverity, setReportIssueSeverity] = useState("");
  const [reportIssueDueDate, setReportIssueDueDate] = useState("");
  const [reportIssueSaving, setReportIssueSaving] = useState(false);

  // ── Config data ────────────────────────────────────
  const [serviceCategories, setServiceCategories] = useState<string[]>(DEFAULT_SERVICE_CATEGORIES);
  const [customProfileFields, setCustomProfileFields] = useState<ProfileField[]>([]);
  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>([]);
  const [ddConfig, setDdConfig] = useState<{ category: string; vrr: number }[]>([]);

  // ── Form state ─────────────────────────────────────
  const [vendorName, setVendorName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [vendorUrl, setVendorUrl] = useState("");
  const [performMonitoring, setPerformMonitoring] = useState(false);
  const [managers, setManagers] = useState<AccountManager[]>([{ ...emptyManager }]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [profileAnswers, setProfileAnswers] = useState<Record<string, string>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

  // ── Existing vendor / engagement selection state ──
  const [vendorSuggestions, setVendorSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isExistingVendor, setIsExistingVendor] = useState(false);
  const [existingEngagements, setExistingEngagements] = useState<Vendor[]>([]);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string>("");
  const [engagementSearchText, setEngagementSearchText] = useState("");
  const [showEngagementSuggestions, setShowEngagementSuggestions] = useState(false);

  // ── Data fetching ──────────────────────────────────
  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      params.append("limit", String(ITEMS_PER_PAGE));
      params.append("offset", String((currentPage - 1) * ITEMS_PER_PAGE));
      const res = await fetch(`/api/tprm/vendors?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVendors(data.data || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, currentPage]);

  const fetchConfigurations = useCallback(async () => {
    try {
      const [catRes, fieldRes, qRes, ccRes] = await Promise.all([
        fetch("/api/tprm/configurations/service-categories"),
        fetch("/api/tprm/configurations/vendor-profile-fields"),
        fetch("/api/tprm/configurations/onboarding-questions"),
        fetch("/api/tprm/control-center"),
      ]);
      if (catRes.ok) {
        const data = await catRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setServiceCategories(data.map((c: { name: string }) => c.name));
        }
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
    } catch {
      // Silently fall back to defaults
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);
  useEffect(() => { fetchConfigurations(); }, [fetchConfigurations]);

  // ── Vendor name autocomplete ──────────────────────
  const handleVendorNameChange = useCallback(async (value: string) => {
    setVendorName(value);
    setIsExistingVendor(false);
    setExistingEngagements([]);
    setSelectedEngagementId("");
    setEngagementSearchText("");
    if (value.trim().length >= 2) {
      try {
        const res = await fetch(`/api/tprm/vendors?mode=suggest&search=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const names: string[] = await res.json();
          setVendorSuggestions(names);
          setShowSuggestions(names.length > 0);
        }
      } catch { /* ignore */ }
    } else {
      setVendorSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const selectExistingVendor = useCallback(async (name: string) => {
    setVendorName(name);
    setShowSuggestions(false);
    setIsExistingVendor(true);
    try {
      const res = await fetch(`/api/tprm/vendors?mode=engagements&search=${encodeURIComponent(name)}`);
      if (res.ok) {
        const engagements: Vendor[] = await res.json();
        setExistingEngagements(engagements);
      }
    } catch { /* ignore */ }
  }, []);

  const selectEngagement = useCallback((engagementVendorId: string) => {
    const eng = existingEngagements.find((e) => e.id === engagementVendorId);
    if (!eng) return;
    setSelectedEngagementId(engagementVendorId);
    setEngagementSearchText(eng.engagementId || eng.vendorCode || "");
    setShowEngagementSuggestions(false);
    // Auto-fill form fields from selected engagement
    const names = (eng.accountManagerName || "").split("; ").filter(Boolean);
    const emails = (eng.accountManagerEmail || "").split("; ").filter(Boolean);
    const phones = (eng.contactPhone || "").split("; ").filter(Boolean);
    const count = Math.max(names.length, emails.length, phones.length, 1);
    setManagers(Array.from({ length: count }, (_, i) => ({
      name: names[i] || "",
      email: emails[i] || "",
      contactNo: phones[i] || "",
    })));
    setServiceCategory(eng.serviceCategory || "");
    setServiceDescription(eng.serviceDescription || "");
  }, [existingEngagements]);

  const filteredEngagements = useMemo(() => {
    if (!engagementSearchText) return existingEngagements;
    const q = engagementSearchText.toLowerCase();
    return existingEngagements.filter((e) =>
      (e.engagementId || e.vendorCode || "").toLowerCase().includes(q) ||
      (e.serviceCategory || "").toLowerCase().includes(q)
    );
  }, [existingEngagements, engagementSearchText]);

  // ── Group vendors by name for accordion display ──
  const vendorGroups = useMemo((): VendorGroup[] => {
    const groupMap = new Map<string, Vendor[]>();
    for (const v of vendors) {
      const key = v.name.toLowerCase();
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(v);
    }
    const VRR_PRIORITY: Record<string, number> = { Critical: 5, High: 4, Moderate: 3, Low: 2, Nominal: 1 };
    return Array.from(groupMap.entries()).map(([, vendorList]) => {
      // Pick the highest VRR among all engagements
      const highestVrr = vendorList.reduce<string | null>((best, v) => {
        if (!v.vrr) return best;
        if (!best) return v.vrr;
        return (VRR_PRIORITY[v.vrr] || 0) > (VRR_PRIORITY[best] || 0) ? v.vrr : best;
      }, null);
      return { name: vendorList[0].name, vrr: highestVrr, vendors: vendorList };
    });
  }, [vendors]);

  // ── Form helpers ───────────────────────────────────
  const resetForm = () => {
    setVendorName("");
    setServiceCategory("");
    setServiceDescription("");
    setVendorUrl("");
    setPerformMonitoring(false);
    setManagers([{ ...emptyManager }]);
    setFormErrors({});
    setProfileAnswers({});
    setQuestionAnswers({});
    setVendorSuggestions([]);
    setShowSuggestions(false);
    setIsExistingVendor(false);
    setExistingEngagements([]);
    setSelectedEngagementId("");
    setEngagementSearchText("");
    setShowEngagementSuggestions(false);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!vendorName.trim()) errors.vendorName = t("Vendor name is required");
    managers.forEach((m, i) => {
      if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) {
        errors[`manager_${i}_email`] = t("Invalid email format");
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateManager = (index: number, field: keyof AccountManager, value: string) => {
    setManagers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const addManager = () => { setManagers((prev) => [...prev, { ...emptyManager }]); };

  const removeManager = (index: number) => {
    if (managers.length <= 1) return;
    setManagers((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => {
    const names = managers.map((m) => m.name).filter(Boolean);
    const emails = managers.map((m) => m.email).filter(Boolean);
    const phones = managers.map((m) => m.contactNo).filter(Boolean);
    return {
      name: vendorName.trim(),
      accountManagerName: names.join("; ") || null,
      accountManagerEmail: emails.join("; ") || null,
      contactPhone: phones.join("; ") || null,
      serviceCategory: serviceCategory || null,
      serviceDescription: serviceDescription || null,
      vendorUrl: vendorUrl.trim() || null,
    };
  };

  const parseManagers = (vendor: Vendor): AccountManager[] => {
    const names = (vendor.accountManagerName || "").split("; ").filter(Boolean);
    const emails = (vendor.accountManagerEmail || "").split("; ").filter(Boolean);
    const phones = (vendor.contactPhone || "").split("; ").filter(Boolean);
    const count = Math.max(names.length, emails.length, phones.length, 1);
    return Array.from({ length: count }, (_, i) => ({
      name: names[i] || "",
      email: emails[i] || "",
      contactNo: phones[i] || "",
    }));
  };

  // ── CRUD handlers ──────────────────────────────────
  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      // Calculate VRR from onboarding answers before sending
      const vrrScore = calculateVrrScore();
      const vrrLabel = getVrrLevel(vrrScore).name;
      // Set status: Nominal → Inactive, else → Onboarding
      const status = vrrLabel === "Nominal" ? "Inactive" : "Onboarding";
      const res = await fetch("/api/tprm/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildPayload(), vrr: vrrLabel, status }),
      });
      if (res.ok) {
        const created = await res.json();
        // Calculate VRR from onboarding answers before resetForm clears them
        const vrrScore = calculateVrrScore();
        const vrrLabel = getVrrLevel(vrrScore).name;
        // Save VRR label to the vendor
        await fetch(`/api/tprm/vendors/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vrr: vrrLabel }),
        });
        // Trigger monitoring assessment if toggle is on and vendor URL is provided
        if (performMonitoring && vendorUrl.trim()) {
          void fetch("/api/tprm/monitoring/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendorName: vendorName.trim(), vendorUrl: vendorUrl.trim() }),
          });
        }
        setCreatedVendorName(vendorName.trim());
        setCreatedVendorId(created.id);
        setShowCreateDialog(false);
        resetForm();
        setShowSuccessPopup(true);
        fetchVendors();
      } else {
        const err = await res.json();
        toast({ title: t("Failed to create vendor"), description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to create vendor"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!validateForm() || !selectedVendor) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tprm/vendors/${selectedVendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) {
        toast({ title: t("Vendor updated successfully") });
        setShowEditDialog(false);
        setSelectedVendor(null);
        fetchVendors();
      } else {
        const err = await res.json();
        toast({ title: t("Failed to update vendor"), description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to update vendor"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVendor) return;
    try {
      const res = await fetch(`/api/tprm/vendors/${selectedVendor.id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: t("Vendor deleted successfully") });
        setShowDeleteDialog(false);
        setSelectedVendor(null);
        fetchVendors();
      } else {
        toast({ title: t("Failed to delete vendor"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to delete vendor"), variant: "destructive" });
    }
  };

  const openCreate = async () => {
    try {
      const res = await fetch("/api/tprm/subscription/validate");
      const data = await res.json();
      if (!data.isValid) {
        toast({ title: t(data.message), variant: "destructive" });
        return;
      }
    } catch {
      toast({ title: t("Failed to validate subscription"), variant: "destructive" });
      return;
    }
    resetForm();
    setShowCreateDialog(true);
  };

  const openEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorName(vendor.name);
    setServiceCategory(vendor.serviceCategory || "");
    setServiceDescription(vendor.serviceDescription || "");
    setVendorUrl(vendor.vendorUrl || "");
    setPerformMonitoring(false);
    setManagers(parseManagers(vendor));
    setFormErrors({});
    setProfileAnswers({});
    setQuestionAnswers({});
    setShowEditDialog(true);
  };

  const handleExport = () => {
    const headers = [
      "Vendor Code", "Vendor Name", "Status", "Service Category",
      "Account Manager", "Account Manager Email", "Contact Phone", "Created At",
    ];
    const rows = vendors.map((v) => [
      v.vendorCode, v.name, v.status, v.serviceCategory || "",
      v.accountManagerName || "", v.accountManagerEmail || "",
      v.contactPhone || "", new Date(v.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendor-inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── VRR helpers ───────────────────────────────────
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

  const getVrrDescription = (levelName: string) => {
    const descriptions: Record<string, string> = {
      Nominal: "This vendor is nominal risk and hence there is no further due-diligence required. Please proceed with contracting.",
      Low: "This vendor is low risk. Basic due-diligence review is recommended.",
      Moderate: "This vendor is medium risk. Standard due-diligence assessment is required.",
      High: "This vendor is high risk. Enhanced due-diligence assessment is required.",
      Critical: "This vendor is critical risk. Comprehensive due-diligence and executive approval is required.",
    };
    return descriptions[levelName] || "";
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
      if (vendorRes.ok) {
        const vendor = await vendorRes.json();
        setRiskRatingVendor(vendor);
      }
      if (templatesRes.ok) {
        const templates: QuestionnaireTemplate[] = await templatesRes.json();
        setQuestionnaireTemplates(templates.filter((t) => t.templateName));
        setSelectedTemplateIds(templates.filter((t) => t.templateName).map((t) => t.id));
      }
    } catch {
      toast({ title: t("Failed to fetch vendor data"), variant: "destructive" });
    } finally {
      setRiskRatingLoading(false);
    }
  };

  const toggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    );
  };

  // ── Report Issue handlers ─────────────────────────
  const openReportIssue = (group: VendorGroup) => {
    setReportIssueGroup(group);
    setReportIssueTitle("");
    setReportIssueDescription("");
    setReportIssueSeverity("");
    setReportIssueDueDate("");
    setShowReportIssueDialog(true);
  };

  const handleReportIssueSubmit = async () => {
    if (!reportIssueGroup || reportIssueGroup.vendors.length === 0) return;
    if (!reportIssueTitle.trim()) {
      toast({ title: t("Error"), description: t("Please enter an issue title"), variant: "destructive" });
      return;
    }
    setReportIssueSaving(true);
    try {
      const vendorId = reportIssueGroup.vendors[0].id;
      const res = await fetch("/api/tprm/rm-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          title: reportIssueTitle.trim(),
          description: reportIssueDescription.trim() || null,
          severity: reportIssueSeverity || null,
          dueDate: reportIssueDueDate || null,
        }),
      });
      if (res.ok) {
        toast({ title: t("Success"), description: t("Issue reported successfully") });
        setShowReportIssueDialog(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("Error"), description: data.error || t("Failed to report issue"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to report issue"), variant: "destructive" });
    } finally {
      setReportIssueSaving(false);
    }
  };

  const openAssessmentForVendor = async (vendor: Vendor) => {
    setCreatedVendorId(vendor.id);
    setCreatedVendorName(vendor.name);
    setRiskRatingLoading(true);
    setShowRiskRatingDialog(true);
    setSelectedTemplateIds([]);
    try {
      const [vendorRes, templatesRes] = await Promise.all([
        fetch(`/api/tprm/vendors/${vendor.id}`),
        fetch("/api/tprm/master-data/questionnaires"),
      ]);
      if (vendorRes.ok) setRiskRatingVendor(await vendorRes.json());
      if (templatesRes.ok) {
        const templates: QuestionnaireTemplate[] = await templatesRes.json();
        setQuestionnaireTemplates(templates.filter((tpl) => tpl.templateName));
        setSelectedTemplateIds(templates.filter((tpl) => tpl.templateName).map((tpl) => tpl.id));
      }
    } catch {
      toast({ title: t("Failed to fetch vendor data"), variant: "destructive" });
    } finally {
      setRiskRatingLoading(false);
    }
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
        .filter((t) => selectedTemplateIds.includes(t.id))
        .map((t) => t.templateName)
        .join(", ");
      const res = await fetch("/api/tprm/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: targetVendorId,
          assessmentType: "Onboarding Assessment",
          questionnaireTemplate: selectedNames,
          status: "Awaiting_Response",
        }),
      });
      if (res.ok) {
        setShowRiskRatingDialog(false);
        setRiskRatingVendor(null);
        setSelectedTemplateIds([]);
        fetchVendors();
        setShowInfoPopup(true);
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

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Onboarding: "bg-blue-100 text-blue-800",
      Onboarded: "bg-green-100 text-green-800",
      Offboarding: "bg-yellow-100 text-yellow-800",
      Offboarded: "bg-slate-100 text-slate-600",
      Inactive: "bg-gray-100 text-gray-600",
    };
    return <Badge className={colors[status] || "bg-slate-100 text-slate-600"}>{t(status)}</Badge>;
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  if (permLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // ── Form fields (shared between Create & Edit dialogs) ──
  const formFields = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">

      {/* ══ Section 1: Vendor Profile Fields (System Generated) ══ */}
      <div className="space-y-4">

        {/* Vendor Name with autocomplete */}
        <div className="space-y-1.5 relative">
          <Label>{t("Vendor Name")} *</Label>
          <Input
            value={vendorName}
            onChange={(e) => handleVendorNameChange(e.target.value)}
            onFocus={() => { if (vendorSuggestions.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={t("Enter vendor name")}
          />
          {formErrors.vendorName && <p className="text-xs text-red-500">{formErrors.vendorName}</p>}
          {/* Vendor name suggestions dropdown */}
          {showSuggestions && vendorSuggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
              {vendorSuggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectExistingVendor(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Engagement selector — shown only when existing vendor is selected */}
        {isExistingVendor && existingEngagements.length > 0 && (
          <div className="space-y-1.5 relative">
            <Label>{t("Select Engagement")}</Label>
            <Input
              value={engagementSearchText}
              onChange={(e) => { setEngagementSearchText(e.target.value); setShowEngagementSuggestions(true); setSelectedEngagementId(""); }}
              onFocus={() => setShowEngagementSuggestions(true)}
              onBlur={() => setTimeout(() => setShowEngagementSuggestions(false), 200)}
              placeholder={t("Search engagements...")}
            />
            {showEngagementSuggestions && filteredEngagements.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {filteredEngagements.map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors ${selectedEngagementId === eng.id ? "bg-primary-50 text-primary-700 font-medium" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectEngagement(eng.id)}
                  >
                    {eng.engagementId || eng.vendorCode} - {eng.serviceCategory || t("No Category")}
                  </button>
                ))}
              </div>
            )}
            {selectedEngagementId && (
              <p className="text-xs text-green-600">{t("Fields auto-filled from selected engagement")}</p>
            )}
          </div>
        )}

        {/* Account Managers */}
        {managers.map((manager, index) => (
          <div key={index} className="space-y-3 border rounded-md p-3 relative">
            {index > 0 && (
              <Button type="button" variant="ghost" size="icon" className="absolute top-1 ltr:right-1 rtl:left-1 h-6 w-6" onClick={() => removeManager(index)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label>{t("Account Manager Name")}</Label>
                <Input value={manager.name} onChange={(e) => updateManager(index, "name", e.target.value)} placeholder={t("Enter account manager name")} />
              </div>
              {index === 0 && (
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={addManager}><Plus className="h-4 w-4" /></Button>
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
              {serviceCategories.map((cat) => <SelectItem key={cat} value={cat}>{t(cat)}</SelectItem>)}
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

        {/* Perform Monitoring Assessment Toggle */}
        <div className="flex items-center gap-3 pt-2">
          <Switch checked={performMonitoring} onCheckedChange={setPerformMonitoring} />
          <Label className="text-sm">{t("Perform Monitoring Assessment")}</Label>
        </div>
      </div>

      {/* ══ Section 2: Vendor Profile Fields (Added by Admin) ══ */}
      {customProfileFields.length > 0 && (
        <div className="space-y-3">
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

      {/* ══ Section 3: Onboarding Questions ══ */}
      {onboardingQuestions.length > 0 && (
        <div className="space-y-3">
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

  // ── Render ─────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500"><Home className="h-4 w-4" /><span>{t("TPRM")}</span></div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Vendor Inventory")}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Vendor Inventory")}</h1>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button variant="outline" onClick={openCreate}><Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Onboard New Vendor")}</Button>
          )}
          <Button onClick={handleExport}><Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Bulk Export")}</Button>
        </div>
      </div>

      {/* ── Outer Group Box — mirrors Mendix "Vendors" groupbox ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
        {/* Group Box Header — light blue, matches Mendix */}
        <div className="bg-primary-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-700">{t("Vendors")}</span>
          <Info className="h-4 w-4 text-slate-400" />
        </div>

        {/* Search & Filter inside group box */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder={t("Search vendors...")} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="w-full sm:w-56 ltr:pl-9 rtl:pr-9 text-sm bg-slate-50 border-slate-200" />
          </div>
          <div className="ltr:ml-0 rtl:mr-0 sm:ltr:ml-auto sm:rtl:mr-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200"><SelectValue placeholder={t("All Status")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Status")}</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Vendor accordion list */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-muted-foreground">{t("No Vendor Details Found")}</p>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {vendorGroups.map((group) => (
              <VendorAccordionItem
                key={group.name}
                group={group}
                isExpanded={expandedVendor === group.name}
                onToggle={() => setExpandedVendor(expandedVendor === group.name ? null : group.name)}
                onExport={(v) => {
                  const headers = ["Vendor Code", "Vendor Name", "Engagement ID", "Status", "Service Category", "Account Manager", "Account Manager Email", "Contact Phone", "Created At"];
                  const rows = group.vendors.map((gv) => [gv.vendorCode, gv.name, gv.engagementId || gv.vendorCode, gv.status, gv.serviceCategory || "", gv.accountManagerName || "", gv.accountManagerEmail || "", gv.contactPhone || "", new Date(gv.createdAt).toLocaleDateString()]);
                  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `${v.name}-export.csv`; a.click();
                  URL.revokeObjectURL(url);
                }}
                onInitiateAssessment={openAssessmentForVendor}
                onReportIssue={openReportIssue}
                onRowClick={(v) => router.push(`/tprm/rm-inventory/${v.id}`)}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Footer — count + pagination */}
        {!loading && vendors.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">{t("Showing")} {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, total)} {t("of")} {total}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((page, idx, arr) => (
                    <span key={page}>
                      {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-1 text-muted-foreground">...</span>}
                      <Button variant={page === currentPage ? "default" : "outline"} size="sm" className="w-8" onClick={() => setCurrentPage(page)}>{page}</Button>
                    </span>
                  ))}
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Onboard New Vendor")}</DialogTitle></DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />} {t("Next")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Edit Vendor")}</DialogTitle></DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />} {t("Save Changes")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedVendor?.name}</DialogTitle></DialogHeader>
          {selectedVendor && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">{t("Vendor Code")}</p><p className="font-medium">{selectedVendor.vendorCode}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("Status")}</p><div className="mt-0.5">{getStatusBadge(selectedVendor.status)}</div></div>
              </div>
              {parseManagers(selectedVendor).map((m, i) => (
                <div key={i} className="border rounded-md p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("Account Manager")} {parseManagers(selectedVendor).length > 1 ? `#${i + 1}` : ""}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><p className="text-xs text-muted-foreground">{t("Name")}</p><p>{m.name || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t("Email")}</p><p>{m.email || "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">{t("Contact Number")}</p><p>{m.contactNo || "-"}</p></div>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">{t("Service Category")}</p><p>{selectedVendor.serviceCategory || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">{t("Created At")}</p><p>{new Date(selectedVendor.createdAt).toLocaleDateString()}</p></div>
              </div>
              <div><p className="text-xs text-muted-foreground">{t("Service Description")}</p><p>{selectedVendor.serviceDescription || "-"}</p></div>
              {selectedVendor.vendorUrl && <div><p className="text-xs text-muted-foreground">{t("Vendor URL")}</p><p>{selectedVendor.vendorUrl}</p></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowViewDialog(false)}>{t("Close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Vendor")}</AlertDialogTitle>
            <AlertDialogDescription>{t("Are you sure you want to delete")} <strong>{selectedVendor?.name}</strong>? {t("This action cannot be undone.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Popup - "Your response has been successfully updated" */}
      <Dialog open={showSuccessPopup} onOpenChange={setShowSuccessPopup}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{t("Success")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex flex-col items-center px-6 py-8">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-base font-semibold text-slate-800 mb-1">{t("Your response has been successfully updated")}</p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
            <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={handleCheckRiskRating}>
              {t("Check Risk Rating")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Popup - "Your assessment is successfully queued" */}
      <Dialog open={showInfoPopup} onOpenChange={setShowInfoPopup}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary-600" />
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{t("Information")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-2">
            <p className="text-sm text-slate-700">{t("Your assessment for")} <strong>{createdVendorName}</strong> {t("is successfully queued.")}</p>
            <p className="text-sm text-slate-500">{t("You will be able to access the assessment once it is completed.")}</p>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
            <Button className="bg-primary-600 hover:bg-primary-700 text-white" onClick={() => setShowInfoPopup(false)}>
              {t("OK")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk Rating Dialog */}
      <Dialog open={showRiskRatingDialog} onOpenChange={setShowRiskRatingDialog}>
        <DialogContent className="max-w-[90vw] lg:max-w-6xl p-0 gap-0 overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                {riskRatingVendor?.name || createdVendorName} - {t("Risk Rating")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {riskRatingLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (() => {
            const vrrScore = parseVrrScore(riskRatingVendor?.vrr ?? null);
            const level = getVrrLevel(vrrScore);
            const cx = 150, cy = 140, r = 110;
            const arcSegments = vrrLevels.map((l, i) => ({
              from: l.min,
              to: i < vrrLevels.length - 1 ? vrrLevels[i + 1].min : 100,
              color: l.color,
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
              <div className={`grid ${riskRatingVendor?.vrr === "Nominal" ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"} gap-0 max-h-[75vh] overflow-y-auto`}>
                {/* Left Column - Risk Rating */}
                <div className="px-6 py-6 space-y-5 lg:border-r border-slate-100">
                  {/* SVG Gauge */}
                  <div className="flex justify-center">
                    <svg viewBox="0 0 300 175" className="w-full max-w-[280px]">
                      {arcSegments.map((seg) => {
                        const start = scoreToXY(seg.from);
                        const end = scoreToXY(seg.to);
                        const largeArc = (seg.to - seg.from) > 50 ? 1 : 0;
                        return (
                          <path
                            key={seg.from}
                            d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={22}
                            strokeLinecap="butt"
                          />
                        );
                      })}
                      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" />
                      <circle cx={cx} cy={cy} r={6} fill="#1e293b" />
                      <circle cx={cx} cy={cy} r={3} fill="#fff" />
                      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="28" fontWeight="bold" fill="#1e293b">{vrrScore}</text>
                      <text x={cx} y={cy + 48} textAnchor="middle" fontSize="12" fontWeight="600" fill={level.color}>{t(level.name)}</text>
                    </svg>
                  </div>

                  {/* Color bar */}
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div className="flex-[20] bg-green-500" />
                    <div className="flex-[10] bg-lime-500" />
                    <div className="flex-[10] bg-yellow-500" />
                    <div className="flex-[10] bg-orange-500" />
                    <div className="flex-[50] bg-red-500" />
                  </div>

                  {/* Risk Level Badges */}
                  <div className="flex flex-wrap justify-center gap-2">
                    {vrrLevels.map((l) => (
                      <span
                        key={l.name}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          level.name === l.name
                            ? "ring-2 ring-offset-1 border-transparent text-white"
                            : "bg-white text-slate-500 border-slate-200"
                        }`}
                        style={level.name === l.name ? { backgroundColor: l.color, ["--tw-ring-color" as string]: l.color } : {}}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                        {t(l.name)}
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-semibold text-slate-800">{t("Vendor Risk Rating")}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{t(getVrrDescription(level.name))}</p>
                  </div>
                </div>

                {/* Right Column - Suggested Questionnaire (hidden for Nominal) */}
                {riskRatingVendor?.vrr !== "Nominal" && <div className="px-6 py-6 space-y-5">
                  <h3 className="text-base font-semibold text-slate-800">{t("Suggested Questionnaire")}</h3>

                  {/* Selected template tags */}
                  {selectedTemplateIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 min-h-[44px]">
                      {questionnaireTemplates
                        .filter((tmpl) => selectedTemplateIds.includes(tmpl.id))
                        .map((tmpl) => (
                          <span key={tmpl.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-100 text-primary-800 text-xs font-medium">
                            {tmpl.templateName}
                            <button type="button" onClick={() => toggleTemplate(tmpl.id)} className="hover:text-primary-600">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Initiate Assessment button - only show if NOT Nominal */}
                  {riskRatingVendor?.vrr !== "Nominal" && (
                    <Button
                      className="bg-primary-600 hover:bg-primary-700 text-white"
                      onClick={handleInitiateAssessment}
                      disabled={initiatingAssessment || selectedTemplateIds.length === 0}
                    >
                      {initiatingAssessment && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
                      {t("Initiate Assessment")}
                    </Button>
                  )}

                  {/* Template card grid */}
                  {questionnaireTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Building2 className="h-8 w-8 mb-2" />
                      <p className="text-sm">{t("No questionnaire templates available")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {questionnaireTemplates.map((tmpl) => {
                        const isSelected = selectedTemplateIds.includes(tmpl.id);
                        const qCount = tmpl.masterQuestionLinks?.length || 0;
                        return (
                          <button
                            key={tmpl.id}
                            type="button"
                            onClick={() => toggleTemplate(tmpl.id)}
                            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center hover:shadow-sm ${
                              isSelected
                                ? "border-primary-500 bg-primary-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute top-1.5 ltr:right-1.5 rtl:left-1.5 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                              {tmpl.imageUrl ? (
                                <img src={tmpl.imageUrl} alt={tmpl.templateName} className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="h-7 w-7 text-slate-400" />
                              )}
                            </div>
                            <span className="text-xs font-medium text-slate-700 line-clamp-2">{tmpl.templateName}</span>
                            {tmpl.frameworkName && (
                              <span className="text-[10px] text-slate-500 line-clamp-1">{tmpl.frameworkName}</span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {qCount} {qCount === 1 ? t("question") : t("questions")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>}
              </div>
            );
          })()}

          {riskRatingVendor?.vrr === "Nominal" && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
              <Button variant="outline" onClick={() => { setShowRiskRatingDialog(false); setRiskRatingVendor(null); setSelectedTemplateIds([]); }}>
                {t("Back To Vendor Inventory")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={showReportIssueDialog} onOpenChange={setShowReportIssueDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Report Issue")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Issue Title */}
            <div className="space-y-1.5">
              <Label>{t("Issue Title")} <span className="text-red-500">*</span></Label>
              <Input
                value={reportIssueTitle}
                onChange={(e) => setReportIssueTitle(e.target.value)}
                placeholder={t("Enter issue title")}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>{t("Description")}</Label>
              <Textarea
                value={reportIssueDescription}
                onChange={(e) => setReportIssueDescription(e.target.value)}
                placeholder={t("Describe the issue in detail")}
                rows={4}
              />
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <Label>{t("Severity")}</Label>
              <Select value={reportIssueSeverity} onValueChange={setReportIssueSeverity}>
                <SelectTrigger><SelectValue placeholder={t("Select Severity")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">{t("Critical")}</SelectItem>
                  <SelectItem value="High">{t("High")}</SelectItem>
                  <SelectItem value="Medium">{t("Medium")}</SelectItem>
                  <SelectItem value="Low">{t("Low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label>{t("Due Date")}</Label>
              <Input
                type="date"
                value={reportIssueDueDate}
                onChange={(e) => setReportIssueDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportIssueDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleReportIssueSubmit} disabled={reportIssueSaving}>
              {reportIssueSaving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />}
              {t("Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
