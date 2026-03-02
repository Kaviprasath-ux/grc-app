"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Minus, Pencil, Trash2, Search, X,
  Download, Upload, Building2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// ==================== TYPES ====================

interface Department {
  id: string;
  name: string;
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
  _count?: { assessments: number };
}

// ==================== HELPERS ====================

const VRR_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border-red-200",
  High: "bg-orange-100 text-orange-800 border-orange-200",
  Moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Low: "bg-green-100 text-green-800 border-green-200",
  Nominal: "bg-blue-100 text-blue-800 border-blue-200",
};

// ==================== MAIN COMPONENT ====================

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

  // Form state
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
      if (res.ok) {
        const data = await res.json();
        setVendors(data.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendors"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

  const resetForm = () => {
    setForm({
      name: "", contactEmail: "", contactPhone: "", accountManagerName: "",
      accountManagerEmail: "", serviceCategory: "", departmentId: "",
      status: "Onboarding", engagementId: "", vrr: "", serviceDescription: "",
      contractStartDate: "", contractEndDate: "",
      accessToNetwork: false, cloud: false, accessToData: false, pii: false,
      businessJustification: "", vendorCertification: "",
    });
  };

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

  const handleExportCsv = () => {
    const headers = ["Vendor Name", "Engagement ID", "Status", "Department", "Service Category", "VRR"];
    const rows = filteredVendors.map((v) => [
      v.name, v.vendorCode, v.status, v.department?.name || "", v.serviceCategory || "", v.vrr || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vendor-inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<Vendor>[] = [
    { accessorKey: "name", header: t("Vendor Name"), cell: ({ row }) => <span className="font-medium text-primary">{row.original.name}</span> },
    { accessorKey: "vendorCode", header: t("Engagement ID"), cell: ({ row }) => <span className="text-sm">{row.original.vendorCode}</span> },
    { accessorKey: "status", header: t("Status"), cell: ({ row }) => <span className="text-sm">{t(row.original.status)}</span> },
    { accessorKey: "department", header: t("Department"), cell: ({ row }) => <span className="text-sm">{row.original.department?.name || "-"}</span> },
    { accessorKey: "serviceCategory", header: t("Service Category"), cell: ({ row }) => <span className="text-sm">{row.original.serviceCategory || "-"}</span> },
    { accessorKey: "vrr", header: t("VRR"), cell: ({ row }) => row.original.vrr ? <Badge variant="outline" className={VRR_COLORS[row.original.vrr] || ""}>{t(row.original.vrr)}</Badge> : <span className="text-muted-foreground">-</span> },
    {
      id: "actions", header: t("Action"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="default" size="icon" className="h-7 w-7" onClick={() => openEdit(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDelete(row.original.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{t("Vendor Inventory")}</h1>

      {/* Header bar */}
      <div className="bg-primary text-primary-foreground rounded-t-lg px-4 py-2 flex items-center justify-between">
        <span className="font-medium">{t("Vendors")}</span>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary">
                {t("Export/Import")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCsv}>
                {t("Download Vendor Profile Template")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t("Import Vendor Profile")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t("Export Vendor Risk Rating Questions")}
              </DropdownMenuItem>
              <DropdownMenuItem>
                {t("Import Responses for Questions")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("Search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        {search && <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
      </div>

      {/* Vendor Accordion List */}
      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : filteredVendors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{t("No vendors found")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map((vendor) => {
            const isExpanded = expandedVendor === vendor.id;
            return (
              <div key={vendor.id} className="border rounded-lg bg-white">
                {/* Vendor Row: "VendorName - VRR" with +/- toggle */}
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setExpandedVendor(isExpanded ? null : vendor.id)}
                >
                  <span className="font-medium">
                    {vendor.name}{vendor.vrr ? ` - ${vendor.vrr}` : ""}
                  </span>
                  <span className="flex-shrink-0 text-muted-foreground">
                    {isExpanded ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </span>
                </button>

                {/* Expanded: DataGrid with single vendor row + detail section */}
                {isExpanded && (
                  <div className="border-t">
                    {/* Export button inside expanded section */}
                    <div className="px-6 pt-3">
                      <Button size="sm" variant="default" onClick={() => {
                        const csv = `Vendor Name,Engagement ID,Status,Department,Service Category,VRR\n${vendor.name},${vendor.vendorCode},${vendor.status},${vendor.department?.name || ""},${vendor.serviceCategory || ""},${vendor.vrr || ""}`;
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${vendor.name}-export.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}>
                        <Upload className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Export")}
                      </Button>
                    </div>

                    {/* Vendor summary table */}
                    <div className="px-4 pb-2">
                      <DataGrid columns={columns} data={[vendor]} hideSearch pageSize={5} />
                    </div>

                    {/* Vendor Detail Section */}
                    <div className="border-t px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Name")}:</span>
                          <span className="text-sm font-medium">{vendor.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Access to Data")}:</span>
                          <span className="text-sm font-medium">{vendor.accessToData ? t("Yes") : t("No")}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Account Manager Name")}:</span>
                          <span className="text-sm font-medium">{vendor.accountManagerName || "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("PII")}:</span>
                          <span className="text-sm font-medium">{vendor.pii ? t("Yes") : t("No")}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Account Manager Email")}:</span>
                          <span className="text-sm font-medium">{vendor.accountManagerEmail || "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Business Justification")}:</span>
                          <span className="text-sm font-medium">{vendor.businessJustification || t("No")}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Contact Number")}:</span>
                          <span className="text-sm font-medium">{vendor.contactPhone || "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Service Category")}:</span>
                          <span className="text-sm font-medium">{vendor.serviceCategory || "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Contract Start Date")}:</span>
                          <span className="text-sm font-medium">{vendor.contractStartDate ? new Date(vendor.contractStartDate).toLocaleDateString() : "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Contract End Date")}:</span>
                          <span className="text-sm font-medium">{vendor.contractEndDate ? new Date(vendor.contractEndDate).toLocaleDateString() : "-"}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground text-sm min-w-[180px]">{t("Vendor Certification")}:</span>
                          <span className="text-sm font-medium">{vendor.vendorCertification || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Report & Document Library */}
                    <div className="border-t px-6 py-3">
                      <h4 className="font-semibold text-primary text-sm">{t("Report Library")}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{t("No reports available")}</p>
                    </div>
                    <div className="border-t px-6 py-3">
                      <h4 className="font-semibold text-primary text-sm">{t("Document Library")}</h4>
                      <div className="mt-2 flex justify-center">
                        <Button variant="outline" size="sm">
                          <Upload className="h-3.5 w-3.5 ltr:mr-1 rtl:ml-1" /> {t("Upload Document")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Vendor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? t("Edit Vendor") : t("Add Vendor")}</DialogTitle></DialogHeader>
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
