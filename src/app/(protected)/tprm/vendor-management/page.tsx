"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Minus, Pencil, Trash2, Search, X, Info,
  Download, Upload, Building2, Shield, Activity, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Home, ChevronRight } from "lucide-react";

// ==================== TYPES ====================

interface Department { id: string; name: string; }

interface MonitoringAssessmentSummary {
  overallScore: number | null;
  securityPostureScore: number | null;
  threatExposureScore: number | null;
  calculatedOverallScore: number | null;
  calculatedSecurityPosture: number | null;
  calculatedThreatExposure: number | null;
}

interface MonitoringVendorSummary {
  id: string;
  vendorName: string;
  vendorURL: string;
  assessments: MonitoringAssessmentSummary[];
}

interface Vendor {
  id: string;
  vendorCode: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  accountManagerName: string | null;
  accountManagerEmail: string | null;
  serviceCategory: string | null;
  departmentId: string | null;
  department: Department | null;
  status: string;
  engagementId: string | null;
  vrr: string | null;
  serviceDescription: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  accessToNetwork: boolean;
  cloud: boolean;
  accessToData: boolean;
  pii: boolean;
  businessJustification: string | null;
  vendorCertification: string | null;
  monitoringVendor: MonitoringVendorSummary | null;
  _count?: { assessments: number };
}

// ==================== HELPERS ====================

const VRR_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border-red-200",
  High:     "bg-orange-100 text-orange-800 border-orange-200",
  Moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Low:      "bg-green-100 text-green-800 border-green-200",
  Nominal:  "bg-blue-100 text-blue-800 border-blue-200",
};

const STATUS_COLORS: Record<string, string> = {
  Onboarding:  "bg-blue-50 text-blue-700",
  Onboarded:   "bg-green-50 text-green-700",
  Offboarding: "bg-orange-50 text-orange-700",
  Offboarded:  "bg-slate-50 text-slate-600",
};

function securityScoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-500";
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

// ==================== VENDOR ROW (accordion item) ====================

function VendorAccordionItem({
  vendor,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onExport,
  t,
}: {
  vendor: Vendor;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (v: Vendor) => void;
  onDelete: (id: string) => void;
  onExport: (v: Vendor) => void;
  t: (s: string) => string;
}) {
  const a = vendor.monitoringVendor?.assessments[0];
  const effOverall = a?.calculatedOverallScore ?? a?.overallScore ?? null;
  const effSP = a?.calculatedSecurityPosture ?? a?.securityPostureScore ?? null;
  const effTE = a?.calculatedThreatExposure ?? a?.threatExposureScore ?? null;

  return (
    <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
      {/* ── Accordion Header ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <span className="font-medium text-sm text-slate-800">
          {vendor.name}{vendor.vrr ? ` - ${vendor.vrr}` : ""}
        </span>
        <span className="text-slate-500 flex-shrink-0">
          {isExpanded
            ? <Minus className="h-4 w-4" />
            : <Plus className="h-4 w-4" />}
        </span>
      </button>

      {/* ── Expanded Body ── */}
      {isExpanded && (
        <div className="border-t border-slate-200">

          {/* Action buttons — mirrors Mendix Export + Report Issue */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <Button size="sm" variant="default" onClick={() => onExport(vendor)}>
              <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
              {t("Export")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(vendor)}>
              <Pencil className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
              {t("Edit")}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(vendor.id)}>
              <Trash2 className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
              {t("Delete")}
            </Button>
          </div>

          {/* ── DataGrid table — mirrors Mendix columns ── */}
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
                  <th className="px-4 py-2.5 font-medium text-slate-600 whitespace-nowrap">{t("Security Score")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-primary">{vendor.name}</td>
                  <td className="px-4 py-3 text-slate-600">{vendor.vendorCode}</td>
                  <td className="px-4 py-3 text-slate-600">{vendor.department?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{vendor.serviceCategory || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[vendor.status] || "bg-slate-50 text-slate-600"}`}>
                      {t(vendor.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {vendor.vrr
                      ? <Badge variant="outline" className={VRR_COLORS[vendor.vrr] || ""}>{t(vendor.vrr)}</Badge>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {effOverall != null
                      ? <span className={`text-sm font-bold rounded px-2 py-0.5 ${securityScoreBadgeClass(effOverall)}`}>{Math.round(effOverall)}</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Service Description group box ── */}
          {vendor.serviceDescription && (
            <div className="mx-4 my-3 border border-slate-200 rounded-md overflow-hidden">
              <div className="bg-primary-50 border-b border-slate-200 px-3 py-1.5">
                <span className="text-xs font-semibold text-slate-700">{t("Service Description")}</span>
              </div>
              <div className="px-3 py-2 text-sm text-slate-600">{vendor.serviceDescription}</div>
            </div>
          )}

          {/* ── Vendor Details group box ── */}
          <div className="mx-4 mb-3 border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-primary-50 border-b border-slate-200 px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-700">{t("Vendor Details")}</span>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {[
                [t("Code"),                vendor.vendorCode],
                [t("Status"),              t(vendor.status)],
                [t("Account Manager"),     vendor.accountManagerName || "—"],
                [t("Account Manager Email"), vendor.accountManagerEmail || "—"],
                [t("Contact Number"),      vendor.contactPhone || "—"],
                [t("Contract Start"),      vendor.contractStartDate ? new Date(vendor.contractStartDate).toLocaleDateString() : "—"],
                [t("Contract End"),        vendor.contractEndDate ? new Date(vendor.contractEndDate).toLocaleDateString() : "—"],
                [t("Vendor Certification"), vendor.vendorCertification || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-xs text-slate-400 min-w-[150px]">{label} :</span>
                  <span className="text-xs text-slate-700 font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Vendor Risk Profile group box ── */}
          <div className="mx-4 mb-3 border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-primary-50 border-b border-slate-200 px-3 py-1.5">
              <span className="text-xs font-semibold text-slate-700">{t("Vendor Risk Profile")}</span>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                [t("Access to Network"), vendor.accessToNetwork],
                [t("Cloud"),             vendor.cloud],
                [t("Access to Data"),    vendor.accessToData],
                [t("PII"),               vendor.pii],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex gap-2">
                  <span className="text-xs text-slate-400">{label} :</span>
                  <span className={`text-xs font-medium ${val ? "text-red-600" : "text-slate-600"}`}>
                    {val ? t("Yes") : t("No")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Security Monitoring group box ── */}
          {vendor.monitoringVendor && (
            <div className="mx-4 mb-3 border border-slate-200 rounded-md overflow-hidden">
              <div className="bg-primary-50 border-b border-slate-200 px-3 py-1.5 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-slate-700">{t("Security Monitoring")}</span>
              </div>
              <div className="p-3 flex flex-wrap gap-3">
                {[
                  [t("Overall Score"),     effOverall,  <Activity key="a" className="h-3.5 w-3.5" />],
                  [t("Security Posture"),  effSP,       <Shield key="s" className="h-3.5 w-3.5" />],
                  [t("Threat Exposure"),   effTE,       <AlertTriangle key="t" className="h-3.5 w-3.5" />],
                ].map(([label, score]) => (
                  <div key={String(label)} className="flex items-center gap-2 border rounded px-3 py-1.5 bg-slate-50 text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-bold rounded px-1.5 py-0.5 ${securityScoreBadgeClass(score as number | null)}`}>
                      {(score as number | null) != null ? Math.round(score as number) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function VendorManagementPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Vendor | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceCategories, setServiceCategories] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    name: "", contactEmail: "", contactPhone: "", accountManagerName: "",
    accountManagerEmail: "", serviceCategory: "", departmentId: "",
    status: "Onboarding", engagementId: "", vrr: "", serviceDescription: "",
    contractStartDate: "", contractEndDate: "",
    accessToNetwork: false, cloud: false, accessToData: false, pii: false,
    businessJustification: "", vendorCertification: "",
  });

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tprm/vendors?limit=500");
      if (res.ok) { const data = await res.json(); setVendors(data.data || []); }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendors"), variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast, t]);

  const loadLookups = useCallback(async () => {
    try {
      const [deptRes, catRes] = await Promise.all([
        fetch("/api/tprm/configurations/departments"),
        fetch("/api/tprm/configurations/service-categories"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (catRes.ok) setServiceCategories(await catRes.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadVendors(); loadLookups(); }, [loadVendors, loadLookups]);

  const filteredVendors = vendors.filter((v) =>
    search === "" ||
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
    (v.serviceCategory || "").toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => setForm({
    name: "", contactEmail: "", contactPhone: "", accountManagerName: "",
    accountManagerEmail: "", serviceCategory: "", departmentId: "",
    status: "Onboarding", engagementId: "", vrr: "", serviceDescription: "",
    contractStartDate: "", contractEndDate: "",
    accessToNetwork: false, cloud: false, accessToData: false, pii: false,
    businessJustification: "", vendorCertification: "",
  });

  const openCreate = () => { setEditItem(null); resetForm(); setDialogOpen(true); };

  const openEdit = (vendor: Vendor) => {
    setEditItem(vendor);
    setForm({
      name: vendor.name,
      contactEmail: vendor.contactEmail || "",
      contactPhone: vendor.contactPhone || "",
      accountManagerName: vendor.accountManagerName || "",
      accountManagerEmail: vendor.accountManagerEmail || "",
      serviceCategory: vendor.serviceCategory || "",
      departmentId: vendor.departmentId || "",
      status: vendor.status,
      engagementId: vendor.engagementId || "",
      vrr: vendor.vrr || "",
      serviceDescription: vendor.serviceDescription || "",
      contractStartDate: vendor.contractStartDate ? vendor.contractStartDate.slice(0, 10) : "",
      contractEndDate: vendor.contractEndDate ? vendor.contractEndDate.slice(0, 10) : "",
      accessToNetwork: vendor.accessToNetwork,
      cloud: vendor.cloud,
      accessToData: vendor.accessToData,
      pii: vendor.pii,
      businessJustification: vendor.businessJustification || "",
      vendorCertification: vendor.vendorCertification || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      const url = editItem ? `/api/tprm/vendors/${editItem.id}` : "/api/tprm/vendors";
      const method = editItem ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          accountManagerName: form.accountManagerName.trim() || null,
          accountManagerEmail: form.accountManagerEmail.trim() || null,
          serviceCategory: form.serviceCategory || null,
          departmentId: form.departmentId || null,
          status: form.status,
          engagementId: form.engagementId.trim() || null,
          vrr: form.vrr || null,
          serviceDescription: form.serviceDescription.trim() || null,
          contractStartDate: form.contractStartDate || null,
          contractEndDate: form.contractEndDate || null,
          accessToNetwork: form.accessToNetwork,
          cloud: form.cloud,
          accessToData: form.accessToData,
          pii: form.pii,
          businessJustification: form.businessJustification.trim() || null,
          vendorCertification: form.vendorCertification.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to save"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: editItem ? t("Vendor updated") : t("Vendor created") });
      setDialogOpen(false);
      loadVendors();
    } catch {
      toast({ title: t("Error"), description: t("Failed to save vendor"), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("Are you sure you want to delete this vendor?"))) return;
    try {
      const res = await fetch(`/api/tprm/vendors/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: t("Error"), description: err.error || t("Failed to delete"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Vendor deleted") });
      loadVendors();
    } catch {
      toast({ title: t("Error"), description: t("Failed to delete vendor"), variant: "destructive" });
    }
  };

  const handleExport = (vendor?: Vendor) => {
    const rows = vendor ? [vendor] : filteredVendors;
    const headers = ["Vendor Name", "Engagement ID", "Status", "Department", "Service Category", "VRR"];
    const data = rows.map((v) => [v.name, v.vendorCode, v.status, v.department?.name || "", v.serviceCategory || "", v.vrr || ""]);
    const csv = [headers.join(","), ...data.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = vendor ? `${vendor.name}-export.csv` : "vendor-inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Vendor Inventory")}</span>
      </nav>

      {/* Page header — mirrors Mendix: title left, buttons right */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Vendor Inventory")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport()}>
            <Download className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
            {t("Bulk Export")}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 ltr:mr-1.5 rtl:ml-1.5" />
            {t("Onboard New Vendor")}
          </Button>
        </div>
      </div>

      {/* ── Outer Group Box — mirrors Mendix "Vendors" groupbox ── */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">

        {/* Group Box Header — light blue, matches Mendix */}
        <div className="bg-primary-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-700">{t("Vendors")}</span>
          <Info className="h-4 w-4 text-slate-400" />
        </div>

        {/* Search — inside group box, matches Mendix */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("Search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
            {search && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Vendor accordion list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">{t("No vendors found")}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 px-4 py-3 space-y-2">
            {filteredVendors.map((vendor) => (
              <VendorAccordionItem
                key={vendor.id}
                vendor={vendor}
                isExpanded={expandedVendor === vendor.id}
                onToggle={() => setExpandedVendor(expandedVendor === vendor.id ? null : vendor.id)}
                onEdit={openEdit}
                onDelete={handleDelete}
                onExport={handleExport}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Footer count — mirrors Mendix "1 to 3 of 3" */}
        {!loading && filteredVendors.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-2 flex justify-end">
            <span className="text-xs text-slate-400">
              {t("1 to")} {filteredVendors.length} {t("of")} {filteredVendors.length}
            </span>
          </div>
        )}
      </div>

      {/* ── Add / Edit Vendor Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? t("Edit Vendor") : t("Onboard New Vendor")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>{t("Vendor Name")} *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("Enter vendor name")} /></div>
            <div>
              <Label>{t("Service Category")}</Label>
              <Select value={form.serviceCategory || "none"} onValueChange={(v) => setForm({ ...form, serviceCategory: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("Select category")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("None")}</SelectItem>
                  {serviceCategories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("Account Manager Name")}</Label><Input value={form.accountManagerName} onChange={(e) => setForm({ ...form, accountManagerName: e.target.value })} /></div>
            <div><Label>{t("Account Manager Email")}</Label><Input type="email" value={form.accountManagerEmail} onChange={(e) => setForm({ ...form, accountManagerEmail: e.target.value })} /></div>
            <div><Label>{t("Contact Email")}</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div><Label>{t("Contact Number")}</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div>
              <Label>{t("Department")}</Label>
              <Select value={form.departmentId || "none"} onValueChange={(v) => setForm({ ...form, departmentId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("Select department")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("None")}</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("Status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Onboarding", "Onboarded", "Offboarding", "Offboarded"].map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
            <div><Label>{t("Engagement ID")}</Label><Input value={form.engagementId} onChange={(e) => setForm({ ...form, engagementId: e.target.value })} /></div>
            <div><Label>{t("Contract Start Date")}</Label><Input type="date" value={form.contractStartDate} onChange={(e) => setForm({ ...form, contractStartDate: e.target.value })} /></div>
            <div><Label>{t("Contract End Date")}</Label><Input type="date" value={form.contractEndDate} onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })} /></div>
            <div className="col-span-full"><Label>{t("Service Description")}</Label><Textarea value={form.serviceDescription} onChange={(e) => setForm({ ...form, serviceDescription: e.target.value })} rows={2} /></div>
            <div className="col-span-full"><Label>{t("Business Justification")}</Label><Textarea value={form.businessJustification} onChange={(e) => setForm({ ...form, businessJustification: e.target.value })} rows={2} /></div>
            <div><Label>{t("Vendor Certification")}</Label><Input value={form.vendorCertification} onChange={(e) => setForm({ ...form, vendorCertification: e.target.value })} /></div>
            <div className="col-span-full grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
              <div className="flex items-center gap-2"><Switch checked={form.accessToNetwork} onCheckedChange={(v) => setForm({ ...form, accessToNetwork: v })} /><Label className="text-sm">{t("Access to Network")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.cloud} onCheckedChange={(v) => setForm({ ...form, cloud: v })} /><Label className="text-sm">{t("Cloud")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.accessToData} onCheckedChange={(v) => setForm({ ...form, accessToData: v })} /><Label className="text-sm">{t("Access to Data")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.pii} onCheckedChange={(v) => setForm({ ...form, pii: v })} /><Label className="text-sm">{t("PII")}</Label></div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("Cancel")}</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
