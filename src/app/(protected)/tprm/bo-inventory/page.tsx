"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Home, ChevronRight, Search, Plus, Download, MoreHorizontal,
  Eye, Pencil, Trash2, Building2, Loader2, ChevronLeft, X,
} from "lucide-react";

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
  status: string;
  vrr: string | null;
  createdAt: string;
  department: { id: string; name: string } | null;
  _count?: { assessments: number };
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
  questionType: string; // "Parent" | "Child"
  parentId: string | null;
  responseType: string; // "Yes/No" | "FreeText"
  isActive: boolean;
  children: OnboardingQuestion[];
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
const SYSTEM_FIELD_NAMES = ["Vendor Name", "Account Manager Name", "Account Manager Email", "Contact Number", "Service Description", "Service Category"];

export default function BOInventoryPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, isLoading: permLoading } = usePermissions("tprm.bo-inventory");

  // ── List state ─────────────────────────────────────
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);

  // ── Dialog state ───────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Config data ────────────────────────────────────
  const [serviceCategories, setServiceCategories] = useState<string[]>(DEFAULT_SERVICE_CATEGORIES);
  const [customProfileFields, setCustomProfileFields] = useState<ProfileField[]>([]);
  const [onboardingQuestions, setOnboardingQuestions] = useState<OnboardingQuestion[]>([]);

  // ── Form state ─────────────────────────────────────
  const [vendorName, setVendorName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [managers, setManagers] = useState<AccountManager[]>([{ ...emptyManager }]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [profileAnswers, setProfileAnswers] = useState<Record<string, string>>({});
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});

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
      const [catRes, fieldRes, qRes] = await Promise.all([
        fetch("/api/tprm/configurations/service-categories"),
        fetch("/api/tprm/configurations/vendor-profile-fields"),
        fetch("/api/tprm/configurations/onboarding-questions"),
      ]);
      if (catRes.ok) {
        const data = await catRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setServiceCategories(data.map((c: { name: string }) => c.name));
        }
      }
      if (fieldRes.ok) {
        const fields: ProfileField[] = await fieldRes.json();
        // Only keep custom (non-system) active fields
        setCustomProfileFields(fields.filter((f) => !f.isSystem && f.isActive));
      }
      if (qRes.ok) {
        const questions: OnboardingQuestion[] = await qRes.json();
        // Only keep active parent-level questions (children are nested)
        setOnboardingQuestions(questions.filter((q) => q.isActive && q.questionType === "Parent"));
      }
    } catch {
      // Silently fall back to defaults
    }
  }, []);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);
  useEffect(() => { fetchConfigurations(); }, [fetchConfigurations]);

  // ── Form helpers ───────────────────────────────────
  const resetForm = () => {
    setVendorName("");
    setServiceCategory("");
    setServiceDescription("");
    setManagers([{ ...emptyManager }]);
    setFormErrors({});
    setProfileAnswers({});
    setQuestionAnswers({});
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

  const addManager = () => {
    setManagers((prev) => [...prev, { ...emptyManager }]);
  };

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
      const res = await fetch("/api/tprm/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) {
        toast({ title: t("Vendor created successfully") });
        setShowCreateDialog(false);
        resetForm();
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

  const openCreate = () => { resetForm(); setShowCreateDialog(true); };

  const openEdit = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setVendorName(vendor.name);
    setServiceCategory(vendor.serviceCategory || "");
    setServiceDescription(vendor.serviceDescription || "");
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

  // ── Badge helpers ──────────────────────────────────
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Onboarding: "bg-blue-100 text-blue-800",
      Onboarded: "bg-green-100 text-green-800",
      Offboarding: "bg-yellow-100 text-yellow-800",
      Offboarded: "bg-slate-100 text-slate-600",
    };
    return <Badge className={colors[status] || "bg-slate-100 text-slate-600"}>{t(status)}</Badge>;
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Form fields (shared between Create & Edit dialogs) ──
  const formFields = (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1">
      {/* ── Vendor Name ── */}
      <div className="space-y-1.5">
        <Label>{t("Vendor Name")} *</Label>
        <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={t("Enter vendor name")} />
        {formErrors.vendorName && <p className="text-xs text-red-500">{formErrors.vendorName}</p>}
      </div>

      {/* ── Account Managers ── */}
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
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={addManager}>
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

      {/* ── Service Category ── */}
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

      {/* ── Service Description ── */}
      <div className="space-y-1.5">
        <Label>{t("Service Description")}</Label>
        <Textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder={t("Describe the services provided")} rows={3} />
      </div>

      {/* ── Custom Vendor Profile Fields ── */}
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

      {/* ── Onboarding Questions ── */}
      {onboardingQuestions.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold text-muted-foreground">{t("Onboarding Questions")}</p>
          {onboardingQuestions.map((q) => (
            <div key={q.id} className="space-y-2">
              <div className="space-y-1.5">
                <Label>{q.title}</Label>
                {q.responseType === "Yes/No" ? (
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={questionAnswers[q.id] === "Yes" ? "default" : "outline"}
                      className={questionAnswers[q.id] === "Yes" ? "bg-green-600 hover:bg-green-700" : ""}
                      onClick={() => setQuestionAnswers((prev) => ({ ...prev, [q.id]: "Yes" }))}
                    >
                      {t("Yes")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={questionAnswers[q.id] === "No" ? "default" : "outline"}
                      className={questionAnswers[q.id] === "No" ? "bg-red-600 hover:bg-red-700" : ""}
                      onClick={() => setQuestionAnswers((prev) => ({ ...prev, [q.id]: "No" }))}
                    >
                      {t("No")}
                    </Button>
                  </div>
                ) : (
                  <Input
                    value={questionAnswers[q.id] || ""}
                    onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={t("Enter your answer")}
                  />
                )}
              </div>
              {/* Child questions – shown when parent answer is "Yes" */}
              {q.children && q.children.length > 0 && questionAnswers[q.id] === "Yes" && (
                <div className="ltr:ml-6 rtl:mr-6 space-y-2 border-l-2 ltr:pl-4 rtl:border-l-0 rtl:border-r-2 rtl:pr-4">
                  {q.children.filter((c) => c.isActive).map((child) => (
                    <div key={child.id} className="space-y-1.5">
                      <Label className="text-sm">{child.title}</Label>
                      {child.responseType === "Yes/No" ? (
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            size="sm"
                            variant={questionAnswers[child.id] === "Yes" ? "default" : "outline"}
                            className={questionAnswers[child.id] === "Yes" ? "bg-green-600 hover:bg-green-700" : ""}
                            onClick={() => setQuestionAnswers((prev) => ({ ...prev, [child.id]: "Yes" }))}
                          >
                            {t("Yes")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={questionAnswers[child.id] === "No" ? "default" : "outline"}
                            className={questionAnswers[child.id] === "No" ? "bg-red-600 hover:bg-red-700" : ""}
                            onClick={() => setQuestionAnswers((prev) => ({ ...prev, [child.id]: "No" }))}
                          >
                            {t("No")}
                          </Button>
                        </div>
                      ) : (
                        <Input
                          value={questionAnswers[child.id] || ""}
                          onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [child.id]: e.target.value }))}
                          placeholder={t("Enter your answer")}
                        />
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Vendor Inventory")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Vendor Inventory")}</h1>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Onboard New Vendor")}
            </Button>
          )}
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Bulk Export")}
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
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

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-muted-foreground">{t("No Vendor Details Found")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Vendor Code")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Vendor Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Service Category")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Account Manager")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Contact Number")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {vendors.map((vendor) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="font-medium">{vendor.vendorCode}</TableCell>
                        <TableCell>{vendor.name}</TableCell>
                        <TableCell>{vendor.serviceCategory || "-"}</TableCell>
                        <TableCell>{vendor.accountManagerName || "-"}</TableCell>
                        <TableCell>{vendor.contactPhone || "-"}</TableCell>
                        <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedVendor(vendor); setShowViewDialog(true); }}>
                                <Eye className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("View")}
                              </DropdownMenuItem>
                              {canEdit && (
                                <DropdownMenuItem onClick={() => openEdit(vendor)}>
                                  <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Edit")}
                                </DropdownMenuItem>
                              )}
                              {canDelete && (
                                <DropdownMenuItem className="text-red-600" onClick={() => { setSelectedVendor(vendor); setShowDeleteDialog(true); }}>
                                  <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Delete")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-sm text-muted-foreground">
                  {t("Showing")} {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, total)} {t("of")} {total}
                </p>
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
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Onboard New Vendor")}</DialogTitle></DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />} {t("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("Edit Vendor")}</DialogTitle></DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>{t("Cancel")}</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin ltr:mr-1 rtl:ml-1" />} {t("Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
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
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setShowViewDialog(false)}>{t("Close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Vendor")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} <strong>{selectedVendor?.name}</strong>? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
