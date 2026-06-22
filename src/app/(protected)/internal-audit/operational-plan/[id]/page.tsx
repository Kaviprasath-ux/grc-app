"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Loader2,
  Home,
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  Sparkles,
  Users,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { confirm } from "@/components/ui/confirm";

interface OpItem {
  id: string;
  title: string;
  auditType: string | null;
  plannedQuarter: string | null;
  residualScore: number | null;
  riskLevel: string | null;
  priorityRank: number | null;
  notes: string | null;
  assignedAuditorId: string | null;
}

interface Auditor {
  id: string;
  fullName: string;
}

interface QuarterReport {
  id: string;
  quarter: string;
  status: string;
  reportDocName: string | null;
  notes: string | null;
  uploadedAt: string | null;
}

interface OperationalPlan {
  id: string;
  planCode: string;
  title: string;
  year: number;
  status: string;
  approvalDocName: string | null;
  hasApprovalDoc?: boolean;
  items: OpItem[];
  quarterReports?: QuarterReport[];
  _count?: { items: number };
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

interface StrategicPlanLite {
  id: string;
  planCode: string;
  title: string;
  durationYears: number;
  startYear: number;
  status: string;
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

export default function OperationalPlanDetailPage() {
  const { t } = useLanguage();
  const routeParams = useParams();
  const selectedSpId = (routeParams?.id as string) || "";
  const { canCreate, canEdit, canDelete } = usePermissions("audit.operational-plan");

  const [selectedSp, setSelectedSp] = useState<StrategicPlanLite | null>(null);
  const [opPlans, setOpPlans] = useState<OperationalPlan[]>([]);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [generatingYear, setGeneratingYear] = useState<number | null>(null);

  // Add-audit dialog
  const [addTarget, setAddTarget] = useState<OperationalPlan | null>(null);
  const [addForm, setAddForm] = useState({ title: "", auditType: "", plannedQuarter: "", notes: "" });
  const [savingItem, setSavingItem] = useState(false);

  // Delete confirms
  const [deletePlan, setDeletePlan] = useState<OperationalPlan | null>(null);

  // Assign-auditors dialog
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [assignTarget, setAssignTarget] = useState<OperationalPlan | null>(null);
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});
  const [savingAssign, setSavingAssign] = useState(false);

  // Fetch the auditor list once (for the Assign Auditors dialog).
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/internal-audit/users?role=auditors");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.users || [];
          setAuditors(list.map((u: { id: string; fullName?: string; name?: string; email?: string }) => ({ id: u.id, fullName: u.fullName || u.name || u.email || "" })));
        }
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const auditorName = (id: string | null) =>
    id ? auditors.find((a) => a.id === id)?.fullName || "—" : "—";

  const openAssign = (plan: OperationalPlan) => {
    setAssignTarget(plan);
    const map: Record<string, string> = {};
    plan.items.forEach((it) => {
      map[it.id] = it.assignedAuditorId || "";
    });
    setAssignMap(map);
  };

  const loadForStrategicPlan = useCallback(async (spId: string) => {
    if (!spId) {
      setSelectedSp(null);
      setOpPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [spRes, opRes] = await Promise.all([
        fetch(`/api/internal-audit/strategic-plans/${spId}`),
        fetch(`/api/internal-audit/operational-plans?strategicPlanId=${spId}`),
      ]);
      if (spRes.ok) setSelectedSp(await spRes.json());
      if (opRes.ok) setOpPlans(await opRes.json());
    } catch {
      toast.error(t("Failed to load operational plans"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadForStrategicPlan(selectedSpId);
  }, [selectedSpId, loadForStrategicPlan]);

  const handleSaveAssignments = async () => {
    if (!assignTarget) return;
    setSavingAssign(true);
    try {
      const changed = assignTarget.items.filter(
        (it) => (it.assignedAuditorId || "") !== (assignMap[it.id] || "")
      );
      await Promise.all(
        changed.map((it) =>
          fetch(`/api/internal-audit/operational-plans/${assignTarget.id}/items/${it.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignedAuditorId: assignMap[it.id] || null }),
          })
        )
      );
      toast.success(t("Auditors assigned"));
      setAssignTarget(null);
      loadForStrategicPlan(selectedSpId);
    } catch {
      toast.error(t("Failed to assign auditors"));
    } finally {
      setSavingAssign(false);
    }
  };

  const years = selectedSp
    ? Array.from({ length: selectedSp.durationYears }, (_, i) => selectedSp.startYear + i)
    : [];
  const visibleYears = yearFilter === "all" ? years : years.filter((y) => String(y) === yearFilter);

  const handleGenerate = async (year: number) => {
    if (!selectedSpId) return;
    setGeneratingYear(year);
    try {
      const res = await fetch("/api/internal-audit/operational-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategicPlanId: selectedSpId, year }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      toast.success(t("Operational plan generated"));
      loadForStrategicPlan(selectedSpId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("Failed to generate operational plan"));
    } finally {
      setGeneratingYear(null);
    }
  };

  const handleAddItem = async () => {
    if (!addTarget) return;
    if (!addForm.title.trim()) {
      toast.error(t("Please enter an audit title"));
      return;
    }
    setSavingItem(true);
    try {
      const res = await fetch(`/api/internal-audit/operational-plans/${addTarget.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Audit added"));
      setAddTarget(null);
      setAddForm({ title: "", auditType: "", plannedQuarter: "", notes: "" });
      loadForStrategicPlan(selectedSpId);
    } catch {
      toast.error(t("Failed to add audit"));
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (planId: string, itemId: string) => {
    if (!(await confirm({ title: t("Delete Audit?"), description: t("This action cannot be undone.") }))) return;
    try {
      const res = await fetch(
        `/api/internal-audit/operational-plans/${planId}/items/${itemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Audit deleted"));
      loadForStrategicPlan(selectedSpId);
    } catch {
      toast.error(t("Failed to delete audit"));
    }
  };

  const handleUploadApproval = async (planId: string, file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/internal-audit/operational-plans/${planId}/approval`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json().catch(() => ({}));
      toast.success(t("Approval document uploaded"));
      if (data?.engagementsCreated > 0) {
        toast.success(
          `${data.engagementsCreated} ${t("audit engagement(s) generated from this plan")}`
        );
      }
      loadForStrategicPlan(selectedSpId);
    } catch {
      toast.error(t("Failed to upload approval document"));
    }
  };

  const handleUploadQuarterReport = async (planId: string, quarter: string, file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("quarter", quarter);
      const res = await fetch(`/api/internal-audit/operational-plans/${planId}/quarter-reports`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Quarterly report uploaded"));
      loadForStrategicPlan(selectedSpId);
    } catch {
      toast.error(t("Failed to upload quarterly report"));
    }
  };

  const handleDeleteQuarterReport = async (planId: string, reportId: string) => {
    if (!(await confirm({ title: t("Remove Quarterly Report?"), description: t("This action cannot be undone.") }))) return;
    try {
      const res = await fetch(
        `/api/internal-audit/operational-plans/${planId}/quarter-reports/${reportId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Quarterly report removed"));
      loadForStrategicPlan(selectedSpId);
    } catch {
      toast.error(t("Failed to remove quarterly report"));
    }
  };

  const handleDeletePlan = async () => {
    if (!deletePlan) return;
    try {
      const res = await fetch(`/api/internal-audit/operational-plans/${deletePlan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Operational plan deleted"));
      setDeletePlan(null);
      loadForStrategicPlan(selectedSpId);
    } catch {
      toast.error(t("Failed to delete operational plan"));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/operational-plan" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Operational Plan")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{selectedSp?.title || t("Operational Plan")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/internal-audit/operational-plan">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
              <ArrowLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              {selectedSp?.title || t("Operational Audit Plan")}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t("Year-wise audit plans derived from a Strategic Plan")}
            </p>
          </div>
        </div>
        {selectedSp && (
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white" position="popper" sideOffset={4}>
              <SelectItem value="all">{t("All Years")}</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {t("Year")} {y - selectedSp.startYear + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin inline" />
        </div>
      ) : !selectedSp ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          {t("Strategic plan not found")}
        </div>
      ) : (
        <div className="space-y-5">
          {visibleYears.map((year) => {
            const plan = opPlans.find((p) => p.year === year);
            const yearLabel = `${t("Year")} ${year - (selectedSp?.startYear ?? year) + 1}`;
            return (
              <div key={year} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-slate-800">{yearLabel}</h3>
                    {plan && (
                      <Badge
                        className={
                          plan.status === "Approved"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }
                      >
                        {plan.status === "Approved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {t(plan.status)}
                      </Badge>
                    )}
                  </div>
                  {plan && (
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAddTarget(plan);
                            setAddForm({ title: "", auditType: "", plannedQuarter: "", notes: "" });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {t("Add Audit")}
                        </Button>
                      )}
                      {canEdit && plan.items.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssign(plan)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          {t("Assign Audit Managers")}
                        </Button>
                      )}
                      {canEdit && (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadApproval(plan.id, f);
                              e.target.value = "";
                            }}
                          />
                          <span className="inline-flex items-center text-sm px-2 py-1 rounded hover:bg-muted">
                            <Upload className="h-4 w-4 mr-1" />
                            {plan.hasApprovalDoc ? t("Replace Approval") : t("Upload Approval")}
                          </span>
                        </label>
                      )}
                      {plan.hasApprovalDoc && (
                        <a
                          href={`/api/internal-audit/operational-plans/${plan.id}/approval-doc`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4 mr-1" />
                            {t("Approval")}
                          </Button>
                        </a>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletePlan(plan)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {!plan ? (
                  <div className="px-4 py-6 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {t("No operational plan generated for this year yet.")}
                    </p>
                    {canCreate && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerate(year)}
                        disabled={generatingYear === year}
                      >
                        {generatingYear === year ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-1" />
                        )}
                        {t("Generate Operational Plan")}
                      </Button>
                    )}
                  </div>
                ) : plan.items.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-slate-400">
                    {t("No audits in this plan. Use Add Audit to add one.")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table className="min-w-[680px]">
                    <TableHeader>
                      <TableRow className="h-11 border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-12 ltr:pl-5 rtl:pr-5">#</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audit")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Type")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Quarter")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audit Manager")}</TableHead>
                        {canDelete && <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">{t("Actions")}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.items.map((it, idx) => (
                        <TableRow key={it.id} className="border-b border-slate-100 last:border-0">
                          <TableCell className="py-3 text-sm text-slate-700 ltr:pl-5 rtl:pr-5">{idx + 1}</TableCell>
                          <TableCell className="py-3 text-sm font-medium text-slate-800">{it.title}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{it.auditType || "—"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{it.plannedQuarter || "—"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">
                            {auditorName(it.assignedAuditorId)}
                          </TableCell>
                          {canDelete && (
                            <TableCell className="py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                                onClick={() => handleDeleteItem(plan.id, it.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}

                {plan && (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">{t("Quarterly Reports")}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {QUARTERS.map((q) => {
                        const report = plan.quarterReports?.find((r) => r.quarter === q);
                        return (
                          <div
                            key={q}
                            className="flex items-center justify-between rounded-md border bg-background px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium">{q}</span>
                              {report ? (
                                <a
                                  href={`/api/internal-audit/operational-plans/${plan.id}/quarter-reports/${report.id}/doc`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline truncate"
                                  title={report.reportDocName || undefined}
                                >
                                  {report.reportDocName}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t("No report")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={`/api/internal-audit/operational-plans/${plan.id}/quarter-summary/${q}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t("Generate Report")}
                              >
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                                </Button>
                              </a>
                              {report && (
                                <a
                                  href={`/api/internal-audit/operational-plans/${plan.id}/quarter-reports/${report.id}/doc`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={t("Download uploaded report")}
                                >
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Download className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                              )}
                              {canEdit && (
                                <label className="cursor-pointer" title={report ? t("Replace") : t("Upload")}>
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleUploadQuarterReport(plan.id, q, f);
                                      e.target.value = "";
                                    }}
                                  />
                                  <span className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted">
                                    <Upload className="h-3.5 w-3.5" />
                                  </span>
                                </label>
                              )}
                              {report && canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDeleteQuarterReport(plan.id, report.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add audit dialog */}
      <Dialog open={!!addTarget} onOpenChange={(o) => !o && setAddTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Audit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Audit Title")}</Label>
              <Input
                value={addForm.title}
                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("Type")}</Label>
                <Input
                  value={addForm.auditType}
                  onChange={(e) => setAddForm({ ...addForm, auditType: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("Quarter")}</Label>
                <Select
                  value={addForm.plannedQuarter}
                  onValueChange={(v) => setAddForm({ ...addForm, plannedQuarter: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t("Notes")}</Label>
              <Textarea
                value={addForm.notes}
                onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTarget(null)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddItem} disabled={savingItem}>
              {savingItem && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign auditors dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Assign Audit Managers")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("Assign an auditor to each audit. On plan approval, the audit is sent to that auditor.")}
          </p>
          <div className="space-y-3 mt-2">
            {assignTarget?.items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_220px] sm:items-center gap-2 border rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{it.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[it.auditType, it.plannedQuarter].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Select
                  value={assignMap[it.id] || "unassigned"}
                  onValueChange={(v) =>
                    setAssignMap((m) => ({ ...m, [it.id]: v === "unassigned" ? "" : v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t("Select audit manager")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white" position="popper" sideOffset={4}>
                    <SelectItem value="unassigned">{t("Unassigned")}</SelectItem>
                    {auditors.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {auditors.length === 0 && (
              <p className="text-xs text-amber-600">{t("No auditors found")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSaveAssignments} disabled={savingAssign}>
              {savingAssign && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete plan confirm */}
      <AlertDialog open={!!deletePlan} onOpenChange={(o) => !o && setDeletePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Operational Plan")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this year's operational plan?")} {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
