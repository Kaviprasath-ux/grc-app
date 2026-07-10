"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Home,
  ChevronRight,
  X,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { isValidName } from "@/lib/validations";
import {
  useTranslatedData,
  triggerTranslation,
} from "@/hooks/useTranslatedData";

interface Department {
  id: string;
  name: string;
}

interface AuditCategory {
  id: string;
  name: string;
}

interface LinkedRiskSummary {
  id: string;
  riskId: string;
  riskName: string;
}

interface ProcessAttachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  uploadedAt: string;
}

interface IAProcess {
  id: string;
  processCode: string | null;
  name: string;
  description: string | null;
  processOwner: string | null;
  departmentId: string | null;
  department: Department | null;
  categoryId: string | null;
  category: AuditCategory | null;
  attachments: ProcessAttachment[];
  linkedRisks: { id: string; risk: LinkedRiskSummary }[];
  createdAt: string;
  updatedAt: string;
}

interface IARisk {
  id: string;
  riskId: string;
  riskName: string;
}

interface AuditHeadUser {
  id: string;
  fullName: string;
  departmentId: string | null;
}

const initialFormState = {
  name: "",
  description: "",
  processOwner: "",
  departmentId: "",
  categoryId: "",
  riskIds: [] as string[],
};

const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function InternalAuditProcessPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions("audit.process");

  const [processes, setProcesses] = useState<IAProcess[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [risks, setRisks] = useState<IARisk[]>([]);
  const [auditHeadUsers, setAuditHeadUsers] = useState<AuditHeadUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<IAProcess | null>(null);
  const [formData, setFormData] = useState({ ...initialFormState });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<IAProcess | null>(null);

  const { data: translatedProcesses } = useTranslatedData(processes, {
    modelName: "InternalAuditProcess",
  });
  const { data: translatedDepartments } = useTranslatedData(departments, {
    modelName: "Department",
  });
  const { data: translatedCategories } = useTranslatedData(categories, {
    modelName: "AuditCategory",
  });
  const { data: translatedRisks } = useTranslatedData(risks, {
    modelName: "InternalAuditRisk",
  });

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [processesRes, deptRes, catRes, riskRes, auditHeadRes] = await Promise.all([
        fetch("/api/internal-audit/processes"),
        fetch("/api/departments"),
        fetch("/api/internal-audit/categories"),
        fetch("/api/internal-audit/risks"),
        fetch("/api/internal-audit/users?role=AuditHead"),
      ]);

      if (processesRes.ok) {
        setProcesses(await processesRes.json());
      }
      if (deptRes.ok) {
        setDepartments(await deptRes.json());
      }
      if (catRes.ok) {
        const raw = (await catRes.json()) as Array<{ id: string; name: string }>;
        setCategories(raw.map((c) => ({ id: c.id, name: c.name })));
      }
      if (riskRes.ok) {
        const raw = (await riskRes.json()) as Array<{
          id: string;
          riskId: string;
          riskName: string;
        }>;
        setRisks(
          raw.map((r) => ({
            id: r.id,
            riskId: r.riskId,
            riskName: r.riskName,
          }))
        );
      }
      if (auditHeadRes.ok) {
        const raw = (await auditHeadRes.json()) as Array<{
          id: string;
          fullName: string;
          departmentId: string | null;
        }>;
        setAuditHeadUsers(raw.map((u) => ({ id: u.id, fullName: u.fullName, departmentId: u.departmentId })));
      }
    } catch (err) {
      console.error("Failed to load IA processes", err);
      toast({
        title: t("Error"),
        description: t("Failed to load processes"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProcesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return translatedProcesses.filter((p) => {
      if (filterDepartment !== "all" && p.departmentId !== filterDepartment) {
        return false;
      }
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.processCode || "").toLowerCase().includes(q) ||
        (p.department?.name || "").toLowerCase().includes(q)
      );
    });
  }, [translatedProcesses, searchQuery, filterDepartment]);

  const riskOptions: MultiSelectOption[] = useMemo(
    () =>
      translatedRisks.map((r) => ({
        value: r.id,
        label: `${r.riskId} — ${r.riskName}`,
      })),
    [translatedRisks]
  );


  const openAddDialog = () => {
    setEditItem(null);
    setFormData({ ...initialFormState });
    setPendingFiles([]);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = (proc: IAProcess) => {
    setEditItem(proc);
    setFormData({
      name: proc.name,
      description: proc.description || "",
      processOwner: proc.processOwner || "",
      departmentId: proc.departmentId || "",
      categoryId: proc.categoryId || "",
      riskIds: proc.linkedRisks.map((l) => l.risk.id),
    });
    setPendingFiles([]);
    setFormErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      errors.name = t("Process name is required");
    } else if (!isValidName(trimmedName)) {
      errors.name = t("Please enter a valid name");
    }
    if (!formData.categoryId) {
      errors.categoryId = t("Audit category is required");
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        processOwner: formData.processOwner.trim() || null,
        departmentId: formData.departmentId || null,
        categoryId: formData.categoryId || null,
        riskIds: formData.riskIds,
      };

      const url = editItem
        ? `/api/internal-audit/processes/${editItem.id}`
        : "/api/internal-audit/processes";
      const method = editItem ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("Failed to save process"));
      }

      const saved = (await res.json()) as IAProcess;

      if (pendingFiles.length > 0) {
        const fd = new FormData();
        pendingFiles.forEach((f) => fd.append("files", f));
        const upRes = await fetch(
          `/api/internal-audit/processes/${saved.id}/attachments`,
          { method: "POST", body: fd }
        );
        if (!upRes.ok) {
          const data = await upRes.json().catch(() => ({}));
          toast({
            title: t("File upload failed"),
            description: data.error || t("Process saved without attachment"),
            variant: "destructive",
          });
        }
      }

      triggerTranslation("InternalAuditProcess", saved.id, {
        name: saved.name,
        description: saved.description || "",
      });

      toast({
        title: editItem ? t("Process updated") : t("Process created"),
      });
      setDialogOpen(false);
      await fetchAll();
    } catch (err) {
      toast({
        title: t("Error"),
        description: err instanceof Error ? err.message : t("Failed to save"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(
        `/api/internal-audit/processes/${itemToDelete.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("Failed to delete"));
      }
      toast({ title: t("Process deleted") });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      await fetchAll();
    } catch (err) {
      toast({
        title: t("Error"),
        description: err instanceof Error ? err.message : t("Failed to delete"),
        variant: "destructive",
      });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setPendingFiles((prev) => [...prev, ...arr]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-slate-500 gap-1.5">
        <Link
          href="/internal-audit/dashboard"
          className="flex items-center gap-1 hover:text-slate-700"
        >
          <Home className="h-3.5 w-3.5" />
          {t("Home")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{t("Organization")}</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-900 font-medium">{t("Process")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {t("Process")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t(
              "Manage internal audit processes and link them to risks from the audit risk register."
            )}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t("Add Process")}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search processes...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("All Departments")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Departments")}</SelectItem>
            {translatedDepartments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-start py-3 ps-5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t("Reference ID")}
                </th>
                <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t("Process Name")}
                </th>
                <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t("Description")}
                </th>
                <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t("Audit Category")}
                </th>
                <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t("Process Owner")}
                </th>
                <th className="text-start py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {t("Department")}
                </th>
                {(canEdit || canDelete) && (
                  <th className="text-end py-3 pe-5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {t("Actions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    {t("Loading...")}
                  </td>
                </tr>
              ) : filteredProcesses.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-slate-500"
                  >
                    {t("No processes found")}
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="text-start py-3.5 ps-5 text-sm font-mono text-slate-700">
                      {p.processCode || "-"}
                    </td>
                    <td className="text-start py-3.5 text-sm font-medium text-slate-800">
                      {p.name}
                    </td>
                    <td className="text-start py-3.5 text-sm text-slate-600">
                      <span className="truncate max-w-[280px] block">
                        {p.description || "-"}
                      </span>
                    </td>
                    <td className="text-start py-3.5 text-sm text-slate-600">
                      {p.categoryId ? (translatedCategories.find((c) => c.id === p.categoryId)?.name ?? p.category?.name ?? "-") : "-"}
                    </td>
                    <td className="text-start py-3.5 text-sm text-slate-600">
                      {auditHeadUsers.find((u) => u.id === p.processOwner)?.fullName || "-"}
                    </td>
                    <td className="text-start py-3.5 text-sm text-slate-600">
                      {p.departmentId ? (translatedDepartments.find((d) => d.id === p.departmentId)?.name ?? p.department?.name ?? "-") : "-"}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="text-end py-3.5 pe-5">
                        <div className="flex items-center justify-end gap-0.5">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                              onClick={() => openEditDialog(p)}
                              title={t("Edit")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                              onClick={() => {
                                setItemToDelete(p);
                                setDeleteDialogOpen(true);
                              }}
                              title={t("Delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editItem ? t("Edit Process") : t("Add Process")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Capture a process owned by the internal audit team and link it to risks from the IA risk register."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ia-process-name">
                  {t("Process Name")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ia-process-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder={t("e.g. Quarterly Revenue Reconciliation")}
                  className={formErrors.name ? "border-red-500" : ""}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ia-process-dept">{t("Department")}</Label>
                <Select
                  value={formData.departmentId || undefined}
                  onValueChange={(v) => {
                    const newDeptId = v === "none" ? "" : v;
                    const ownerStillValid = auditHeadUsers.some(
                      (u) => u.id === formData.processOwner && u.departmentId === newDeptId
                    );
                    setFormData({
                      ...formData,
                      departmentId: newDeptId,
                      processOwner: ownerStillValid ? formData.processOwner : "",
                    });
                  }}
                >
                  <SelectTrigger id="ia-process-dept" className="w-full">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("Select")}</SelectItem>
                    {translatedDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ia-process-category">
                {t("Audit Category")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.categoryId || undefined}
                onValueChange={(v) =>
                  setFormData({ ...formData, categoryId: v === "none" ? "" : v })
                }
              >
                <SelectTrigger
                  id="ia-process-category"
                  className={`w-full ${formErrors.categoryId ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder={t("Select audit category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("Select")}</SelectItem>
                  {translatedCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.categoryId && (
                <p className="text-xs text-red-500">{formErrors.categoryId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ia-process-owner">{t("Process Owner")}</Label>
              {(() => {
                const ownerOptions = formData.departmentId
                  ? auditHeadUsers.filter((u) => u.departmentId === formData.departmentId)
                  : [];
                return (
                  <>
                    <Select
                      key={`owner-${formData.departmentId}`}
                      value={formData.processOwner || undefined}
                      disabled={!formData.departmentId}
                      onValueChange={(v) =>
                        setFormData({ ...formData, processOwner: v === "none" ? "" : v })
                      }
                    >
                      <SelectTrigger id="ia-process-owner" className="w-full">
                        <SelectValue
                          placeholder={
                            formData.departmentId
                              ? t("Select process owner")
                              : t("Select a department first")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("Select")}</SelectItem>
                        {ownerOptions.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400">
                            {t("No audit heads in this department")}
                          </div>
                        ) : (
                          ownerOptions.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {!formData.departmentId && (
                      <p className="text-xs text-slate-400">
                        {t("Please select a department to view available process owners.")}
                      </p>
                    )}
                    {formData.departmentId && ownerOptions.length === 0 && (
                      <p className="text-xs text-amber-600">
                        {t("No audit heads are assigned to the selected department.")}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ia-process-desc">{t("Description")}</Label>
              <Textarea
                id="ia-process-desc"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("Briefly describe this process")}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("Link Risk")}</Label>
              <MultiSelect
                options={riskOptions}
                selected={formData.riskIds}
                onChange={(vals) =>
                  setFormData({ ...formData, riskIds: vals })
                }
                placeholder={t("Select risks from IA register...")}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                {t(
                  "Risks are pulled from the Internal Audit risk register."
                )}
              </p>
            </div>

            {/* Document upload card */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-base font-medium">{t("Document")}</Label>
              <p className="text-sm text-muted-foreground">
                {t(
                  "Upload supporting documents for this process. Multiple files can be attached."
                )}
              </p>

              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {t("Drag and drop files here, or")}{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {t("browse")}
                    </button>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("Supported formats: PDF, DOCX, XLSX, CSV, PNG, JPG, PPT")}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.ppt,.pptx"
                  />
                </div>
              </div>

              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("Files to Upload")} ({pendingFiles.length})
                  </Label>
                  <div className="border rounded-lg divide-y">
                    {pendingFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t("Remove")}
                          onClick={() => removePendingFile(index)}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editItem && editItem.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {t("Existing Documents")} ({editItem.attachments.length})
                  </Label>
                  <div className="border rounded-lg divide-y">
                    {editItem.attachments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50"
                      >
                        <FileText className="h-5 w-5 text-slate-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {a.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(a.fileSize)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editItem ? t("Save Changes") : t("Create Process")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Process")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Are you sure you want to delete this process? This will also remove all linked risks and uploaded documents. This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
