"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Printer,
  Upload,
  Download,
  CheckCircle2,
  Loader2,
  Home,
  ChevronRight,
  CalendarRange,
  ShieldCheck,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface PlanItem {
  id: string;
  year: number;
  title: string;
  departmentId: string | null;
  riskId: string | null;
  auditType: string | null;
  residualScore: number | null;
  riskLevel: string | null;
  priorityRank: number | null;
  notes: string | null;
}

interface AssessedRisk {
  id: string;
  riskId: string;
  riskName: string;
  inherentScore: number | null;
  residualScore: number | null;
  riskLevel: string | null;
  departmentId: string | null;
  departmentName: string | null;
}

interface StrategicPlan {
  id: string;
  planCode: string;
  title: string;
  description: string | null;
  durationYears: number;
  startYear: number;
  status: string;
  generatedFromRisk: boolean;
  approvedByName: string | null;
  approvedAt: string | null;
  signedCopyName: string | null;
  hasSignedCopy?: boolean;
  createdBy: { id: string; fullName: string } | null;
  items?: PlanItem[];
  _count?: { items: number };
}

const riskLevelColor = (level: string | null): string => {
  switch ((level || "").toLowerCase()) {
    case "extreme":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-orange-100 text-orange-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "low":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

const statusColor = (status: string): string => {
  switch (status) {
    case "Approved":
      return "bg-green-100 text-green-700";
    case "Pending Approval":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

export default function StrategicPlanPage() {
  const { t } = useLanguage();
  const { canCreate, canDelete, canApprove } = usePermissions("audit.strategic-plan");

  const [plans, setPlans] = useState<StrategicPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    title: "",
    durationYears: "3",
    startYear: String(currentYear),
    description: "",
    generateFromRisk: true,
  });

  // View dialog state
  const [viewPlan, setViewPlan] = useState<StrategicPlan | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Approve state
  const [approvedByName, setApprovedByName] = useState("");
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [approving, setApproving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<StrategicPlan | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal-audit/strategic-plans");
      if (!res.ok) throw new Error("Failed");
      setPlans(await res.json());
    } catch {
      toast.error(t("Failed to load strategic plans"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // ----- Risk Assessment section (assessed risks not yet added to a plan) -----
  const [assessedRisks, setAssessedRisks] = useState<AssessedRisk[]>([]);
  const { data: translatedAssessedRisks } = useTranslatedData(assessedRisks, { modelName: 'InternalAuditRisk' });
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>("all");
  const filteredAssessedRisks =
    riskLevelFilter === "all"
      ? translatedAssessedRisks
      : translatedAssessedRisks.filter(
          (r) => (r.riskLevel || "").toLowerCase() === riskLevelFilter.toLowerCase()
        );

  // Add Plan popup state — only the plan duration is captured here.
  const [planDialogRisk, setPlanDialogRisk] = useState<AssessedRisk | null>(null);
  const [planDuration, setPlanDuration] = useState("3");
  const [planAuditType, setPlanAuditType] = useState("");
  const [planReason, setPlanReason] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // Audit types (from Audit Settings) for the Add Plan dialog dropdown.
  const [auditTypes, setAuditTypes] = useState<{ id: string; name: string }[]>([]);
  const { data: translatedAuditTypes } = useTranslatedData(auditTypes, { modelName: 'AuditType' });
  // Map original audit type name → translated name for table display
  const auditTypeTranslationMap = useMemo(() => {
    const map = new Map<string, string>();
    auditTypes.forEach((at, i) => {
      const translated = translatedAuditTypes[i];
      if (translated) map.set(at.name, translated.name);
    });
    return map;
  }, [auditTypes, translatedAuditTypes]);

  // Department translation — build unique dept list from assessedRisks for lookup
  const uniqueDepartments = useMemo(() => {
    const seen = new Set<string>();
    const depts: { id: string; name: string }[] = [];
    for (const r of assessedRisks) {
      if (r.departmentId && !seen.has(r.departmentId)) {
        seen.add(r.departmentId);
        depts.push({ id: r.departmentId, name: r.departmentName ?? "" });
      }
    }
    return depts;
  }, [assessedRisks]);
  const { data: translatedDepartments } = useTranslatedData(uniqueDepartments, { modelName: 'Department' });
  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    uniqueDepartments.forEach((d, i) => {
      const translated = translatedDepartments[i];
      if (translated) map.set(d.id, translated.name);
    });
    return map;
  }, [uniqueDepartments, translatedDepartments]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/internal-audit/audit-types");
        if (res.ok) {
          const data = await res.json();
          setAuditTypes((Array.isArray(data) ? data : []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
        }
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  // Edit / delete a single strategic plan item (audit).
  const [editItem, setEditItem] = useState<PlanItem | null>(null);
  const [editItemForm, setEditItemForm] = useState({ title: "", auditType: "", year: "", notes: "" });
  const [savingItem, setSavingItem] = useState(false);
  const [deleteItem, setDeleteItem] = useState<PlanItem | null>(null);

  const fetchAssessedRisks = useCallback(async () => {
    try {
      const res = await fetch("/api/internal-audit/strategic-plans/assessed-risks");
      if (res.ok) setAssessedRisks(await res.json());
    } catch {
      /* non-fatal */
    }
  }, []);

  // Open the Add Plan popup for an assessed risk; default duration to the
  // existing plan's duration (or 3 years when no plan exists yet).
  const openPlanDialog = (risk: AssessedRisk) => {
    setPlanDialogRisk(risk);
    setPlanDuration("3");
    setPlanAuditType("");
    setPlanReason("");
    setPlanNotes("");
  };

  const handleSavePlan = async () => {
    if (!planDialogRisk) return;
    setSavingPlan(true);
    try {
      const res = await fetch("/api/internal-audit/strategic-plans/add-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskId: planDialogRisk.id,
          durationYears: parseInt(planDuration),
          auditType: planAuditType || undefined,
          reasonForScheduling: planReason || undefined,
          notes: planNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Added to strategic plan"));
      setPlanDialogRisk(null);
      fetchAssessedRisks();
      fetchPlans();
    } catch {
      toast.error(t("Failed to add to strategic plan"));
    } finally {
      setSavingPlan(false);
    }
  };

  // Open the edit dialog for a plan item (title / type / notes).
  const openEditItem = (item: PlanItem) => {
    setEditItem(item);
    setEditItemForm({
      title: item.title,
      auditType: item.auditType || "",
      year: String(item.year),
      notes: item.notes || "",
    });
  };

  const handleSaveItem = async () => {
    if (!editItem) return;
    setSavingItem(true);
    try {
      const res = await fetch(`/api/internal-audit/strategic-plans/items/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editItemForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Audit updated"));
      setEditItem(null);
      fetchPlans();
    } catch {
      toast.error(t("Failed to update audit"));
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    try {
      const res = await fetch(`/api/internal-audit/strategic-plans/items/${deleteItem.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Audit removed from plan"));
      setDeleteItem(null);
      fetchPlans();
      fetchAssessedRisks();
    } catch {
      toast.error(t("Failed to remove audit"));
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchAssessedRisks();
  }, [fetchPlans, fetchAssessedRisks]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      // Title is auto-derived from the duration (the Plan Title field was removed).
      const title = `${form.durationYears}-Year Internal Audit Strategy`;
      const res = await fetch("/api/internal-audit/strategic-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: form.description,
          durationYears: parseInt(form.durationYears),
          startYear: parseInt(form.startYear),
          generateFromRisk: form.generateFromRisk,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Strategic plan created"));
      setCreateOpen(false);
      setForm({
        title: "",
        durationYears: "3",
        startYear: String(currentYear),
        description: "",
        generateFromRisk: true,
      });
      fetchPlans();
    } catch {
      toast.error(t("Failed to create strategic plan"));
    } finally {
      setSaving(false);
    }
  };

  const openView = async (id: string) => {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/internal-audit/strategic-plans/${id}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setViewPlan(data);
      setApprovedByName(data.approvedByName || "");
      setSignedFile(null);
    } catch {
      toast.error(t("Failed to load plan"));
    } finally {
      setViewLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!viewPlan) return;
    if (!signedFile) {
      toast.error(t("Please select the signed copy to upload"));
      return;
    }
    setApproving(true);
    try {
      const fd = new FormData();
      fd.append("file", signedFile);
      fd.append("approvedByName", approvedByName);
      const res = await fetch(`/api/internal-audit/strategic-plans/${viewPlan.id}/approve`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Strategic plan approved"));
      await openView(viewPlan.id);
      fetchPlans();
    } catch {
      toast.error(t("Failed to approve plan"));
    } finally {
      setApproving(false);
    }
  };

  const handleRevoke = async () => {
    if (!viewPlan) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/internal-audit/strategic-plans/${viewPlan.id}/approve`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Approval revoked"));
      await openView(viewPlan.id);
      fetchPlans();
    } catch {
      toast.error(t("Failed to revoke approval"));
    } finally {
      setApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/internal-audit/strategic-plans/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Strategic plan deleted"));
      setDeleteTarget(null);
      fetchPlans();
    } catch {
      toast.error(t("Failed to delete strategic plan"));
    }
  };

  const planYears = (plan: StrategicPlan): number[] =>
    Array.from({ length: plan.durationYears }, (_, i) => plan.startYear + i);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Strategic Plan")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-slate-700" />
            {t("Strategic Audit Plan")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("Multi-year, risk-based audit strategy")}
          </p>
        </div>
      </div>

      {/* Section 1: Risk Assessment (assessed risks not yet added to a plan) */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-semibold text-slate-800">{t("Risk Assessment")}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{t("Risk Level")}</span>
            <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Levels")}</SelectItem>
                <SelectItem value="Extreme">{t("Extreme")}</SelectItem>
                <SelectItem value="High">{t("High")}</SelectItem>
                <SelectItem value="Medium">{t("Medium")}</SelectItem>
                <SelectItem value="Low">{t("Low")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Risk ID")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Risk")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Risk Level")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssessedRisks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sm text-slate-400">
                    {assessedRisks.length === 0
                      ? t("No assessed risks available to plan")
                      : t("No risks match the selected risk level.")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAssessedRisks.map((r) => (
                  <TableRow key={r.id} className="border-b border-slate-100 last:border-0">
                    <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{r.riskId}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{r.riskName}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{r.departmentId ? (deptNameMap.get(r.departmentId) ?? r.departmentName) : r.departmentName || "—"}</TableCell>
                    <TableCell className="py-3">
                      {r.riskLevel ? (
                        <Badge className={statusColor(r.riskLevel)}>{t(r.riskLevel)}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">
                      {canCreate && (
                        <Button size="sm" onClick={() => openPlanDialog(r)}>
                          <Plus className="h-4 w-4 mr-1" />
                          {t("Add Plan")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </div>

      {/* Section 2: Strategic Plan — flat audits table (no per-plan header) */}
      <h2 className="text-lg font-semibold text-slate-800 mb-2">{t("Strategic Plan")}</h2>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin inline text-slate-400" />
        </div>
      ) : (
        (() => {
          const rows = plans.flatMap((p) => (p.items || []).map((it) => ({ it, plan: p })));
          if (rows.length === 0) {
            return (
              <div className="bg-white rounded-xl border border-slate-200 py-8 text-center text-sm text-slate-400">
                {t("No audits yet. Use Add Plan on an assessed risk above.")}
              </div>
            );
          }
          return (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-12 ltr:pl-5 rtl:pr-5">#</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audit")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Type")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Duration")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ it, plan }, idx) => (
                      <TableRow key={it.id} className="border-b border-slate-100 last:border-0">
                        <TableCell className="py-3 text-sm text-slate-700 ltr:pl-5 rtl:pr-5">{idx + 1}</TableCell>
                        <TableCell className="py-3 text-sm font-medium text-slate-800">{it.title}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{it.auditType ? (auditTypeTranslationMap.get(it.auditType) ?? it.auditType) : "—"}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">
                          {plan.durationYears} {t("Years")}
                        </TableCell>
                        <TableCell className="py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">
                          {plan.status !== "Approved" && (
                            <div className="flex ltr:justify-end rtl:justify-start items-center gap-0.5">
                              {canCreate && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                  onClick={() => openEditItem(it)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                                  onClick={() => setDeleteItem(it)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })()
      )}

      {/* Add Plan popup — capture the plan-item details for an assessed risk */}
      <Dialog open={!!planDialogRisk} onOpenChange={(o) => !o && setPlanDialogRisk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Plan")}</DialogTitle>
          </DialogHeader>
          {planDialogRisk && (
            <div className="space-y-4">
              {/* Risk context (read-only) */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <span className="text-slate-500">{t("Risk ID")}: </span>
                  <span className="font-medium text-slate-800">{planDialogRisk.riskId}</span>
                </div>
                <div>
                  <span className="text-slate-500">{t("Risk Level")}: </span>
                  {planDialogRisk.riskLevel ? t(planDialogRisk.riskLevel) : "—"}
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">{t("Risk")}: </span>
                  {planDialogRisk.riskName}
                </div>
                <div>
                  <span className="text-slate-500">{t("Department")}: </span>
                  {planDialogRisk.departmentId ? (deptNameMap.get(planDialogRisk.departmentId) ?? planDialogRisk.departmentName) : planDialogRisk.departmentName || "—"}
                </div>
              </div>

              <div>
                <Label>{t("Audit Type")}</Label>
                <Select value={planAuditType} onValueChange={setPlanAuditType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {auditTypes.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-slate-400 text-center">
                        {t("No audit types found")}
                      </div>
                    ) : (
                      auditTypes.map((at, i) => (
                        <SelectItem key={at.id} value={at.name}>
                          {translatedAuditTypes[i]?.name ?? at.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t("Duration")}</Label>
                <Select value={planDuration} onValueChange={setPlanDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 {t("Years")}</SelectItem>
                    <SelectItem value="4">4 {t("Years")}</SelectItem>
                    <SelectItem value="5">5 {t("Years")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-1">
                  {t("The audit is added to the plan of this duration (a new plan is created if needed).")}
                </p>
              </div>

              <div>
                <Label>{t("Reason for Scheduling")}</Label>
                <Textarea
                  rows={2}
                  value={planReason}
                  onChange={(e) => setPlanReason(e.target.value)}
                  placeholder={t("Why is this audit being scheduled?")}
                />
              </div>

              <div>
                <Label>{t("Notes")}</Label>
                <Textarea
                  rows={2}
                  value={planNotes}
                  onChange={(e) => setPlanNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogRisk(null)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSavePlan} disabled={savingPlan}>
              {savingPlan && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Create Strategic Plan")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("Duration")}</Label>
                <Select
                  value={form.durationYears}
                  onValueChange={(v) => setForm({ ...form, durationYears: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 {t("Years")}</SelectItem>
                    <SelectItem value="4">4 {t("Years")}</SelectItem>
                    <SelectItem value="5">5 {t("Years")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Start Year")}</Label>
                <Input
                  type="number"
                  value={form.startYear}
                  onChange={(e) => setForm({ ...form, startYear: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{t("Description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("Audits are automatically populated from the risk register, ranked by residual risk — highest-risk audits scheduled in the earliest years.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewPlan} onOpenChange={(o) => !o && setViewPlan(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full">
          {viewLoading || !viewPlan ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin inline" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewPlan.planCode} — {viewPlan.title}
                </DialogTitle>
              </DialogHeader>

              <div id="strategic-plan-print" className="space-y-4">
                {/* Header / status */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border ${
                    viewPlan.status === "Approved"
                      ? "bg-green-50 border-green-200"
                      : "bg-muted/40"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={statusColor(viewPlan.status)}>
                        {viewPlan.status === "Approved" && (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        {t(viewPlan.status)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {viewPlan.durationYears} {t("Years")} · {viewPlan.startYear}–
                        {viewPlan.startYear + viewPlan.durationYears - 1}
                      </span>
                    </div>
                    {viewPlan.status === "Approved" && (
                      <p className="text-sm text-green-700 flex items-center gap-1">
                        <ShieldCheck className="h-4 w-4" />
                        {t("Approved by")} {viewPlan.approvedByName || "—"}
                        {viewPlan.approvedAt &&
                          ` · ${new Date(viewPlan.approvedAt).toLocaleDateString()}`}
                      </p>
                    )}
                    {viewPlan.description && (
                      <p className="text-sm text-muted-foreground">{viewPlan.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="h-4 w-4 mr-1" />
                      {t("Print")}
                    </Button>
                    {viewPlan.hasSignedCopy && (
                      <a
                        href={`/api/internal-audit/strategic-plans/${viewPlan.id}/signed-copy`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          {t("Signed Copy")}
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                {/* Years */}
                <div className="space-y-4">
                  {planYears(viewPlan).map((year) => {
                    const items = (viewPlan.items || []).filter((it) => it.year === year);
                    return (
                      <div key={year} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between bg-muted/50 px-4 py-2">
                          <h3 className="font-semibold">
                            {t("Year")} {year - viewPlan.startYear + 1} · {year}{" "}
                            <span className="text-muted-foreground font-normal">
                              ({items.length} {t("audits")})
                            </span>
                          </h3>
                          <Link
                            href={`/internal-audit/operational-plan?planId=${viewPlan.id}&year=${year}`}
                            className="print:hidden"
                          >
                            <Button variant="ghost" size="sm">
                              {t("Open Annual Plan")}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </div>
                        {items.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted-foreground">
                            {t("No audits scheduled for this year")}
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>{t("Audit")}</TableHead>
                                <TableHead>{t("Type")}</TableHead>
                                <TableHead>{t("Risk Level")}</TableHead>
                                <TableHead className="text-right">{t("Residual Score")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((it) => (
                                <TableRow key={it.id}>
                                  <TableCell>{it.priorityRank ?? "—"}</TableCell>
                                  <TableCell className="font-medium">{it.title}</TableCell>
                                  <TableCell>{it.auditType ? (auditTypeTranslationMap.get(it.auditType) ?? it.auditType) : "—"}</TableCell>
                                  <TableCell>
                                    {it.riskLevel ? (
                                      <Badge className={riskLevelColor(it.riskLevel)}>
                                        {t(it.riskLevel)}
                                      </Badge>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {it.residualScore ?? "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Approval section — the Minister approves externally; uploading the
                    signed copy records that approval and marks the plan Approved. */}
                {canApprove && (
                  <div className="border-t pt-4 print:hidden">
                    {viewPlan.status !== "Approved" ? (
                      <div className="space-y-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4" />
                          {t("Approval")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {t("Upload the signed copy to mark this strategic plan as approved.")}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>{t("Approved By")}</Label>
                            <Input
                              value={approvedByName}
                              onChange={(e) => setApprovedByName(e.target.value)}
                              placeholder={t("Name of approving authority")}
                            />
                          </div>
                          <div>
                            <Label>{t("Signed Copy")}</Label>
                            <Input
                              type="file"
                              onChange={(e) =>
                                setSignedFile(e.target.files?.[0] || null)
                              }
                            />
                          </div>
                        </div>
                        <Button onClick={handleApprove} disabled={approving}>
                          {approving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {t("Upload & Approve")}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={handleRevoke}
                        disabled={approving}
                      >
                        {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        {t("Revoke Approval")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Edit Audit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Audit Title")}</Label>
              <Input
                value={editItemForm.title}
                onChange={(e) => setEditItemForm({ ...editItemForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("Audit Type")}</Label>
              <Input
                value={editItemForm.auditType}
                onChange={(e) => setEditItemForm({ ...editItemForm, auditType: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("Notes")}</Label>
              <Textarea
                value={editItemForm.notes}
                onChange={(e) => setEditItemForm({ ...editItemForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveItem} disabled={savingItem}>
              {savingItem && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete item confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Remove Audit")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to remove")} &quot;{deleteItem?.title}&quot;{" "}
              {t("from the strategic plan?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-red-600 hover:bg-red-700">
              {t("Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Strategic Plan")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} {deleteTarget?.planCode}? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
