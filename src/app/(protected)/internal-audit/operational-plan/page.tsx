"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  CalendarClock,
  Plus,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface OpItem {
  id: string;
  title: string;
  auditType: string | null;
  plannedQuarter: string | null;
  residualScore: number | null;
  riskLevel: string | null;
  priorityRank: number | null;
  notes: string | null;
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

function OperationalPlanContent() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const { canCreate, canEdit, canDelete } = usePermissions("audit.operational-plan");

  const [strategicPlans, setStrategicPlans] = useState<StrategicPlanLite[]>([]);
  const [selectedSpId, setSelectedSpId] = useState<string>("");
  const [selectedSp, setSelectedSp] = useState<StrategicPlanLite | null>(null);
  const [opPlans, setOpPlans] = useState<OperationalPlan[]>([]);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [generatingYear, setGeneratingYear] = useState<number | null>(null);

  // Add-audit dialog
  const [addTarget, setAddTarget] = useState<OperationalPlan | null>(null);
  const [addForm, setAddForm] = useState({ title: "", auditType: "", plannedQuarter: "", notes: "" });
  const [savingItem, setSavingItem] = useState(false);

  // Delete confirms
  const [deletePlan, setDeletePlan] = useState<OperationalPlan | null>(null);

  // Fetch strategic plans for the selector
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/internal-audit/strategic-plans");
        if (res.ok) {
          const data: StrategicPlanLite[] = await res.json();
          setStrategicPlans(data);
          const urlPlanId = params.get("planId");
          if (urlPlanId && data.some((p) => p.id === urlPlanId)) {
            setSelectedSpId(urlPlanId);
          } else if (data.length === 1) {
            setSelectedSpId(data[0].id);
          }
        }
      } catch {
        toast.error(t("Failed to load strategic plans"));
      }
      const urlYear = params.get("year");
      if (urlYear) setYearFilter(urlYear);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadForStrategicPlan = useCallback(async (spId: string) => {
    if (!spId) {
      setSelectedSp(null);
      setOpPlans([]);
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
    } catch (e: any) {
      toast.error(e.message || t("Failed to generate operational plan"));
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
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>{t("Internal Audit")}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{t("Operational Plan")}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="h-6 w-6" />
          {t("Operational Audit Plan")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Year-wise audit plans derived from a Strategic Plan")}
        </p>
      </div>

      {/* Selectors */}
      <div className="flex items-center gap-3 w-full sm:w-auto sm:ltr:ml-auto sm:rtl:mr-auto justify-end">
        <Select value={selectedSpId} onValueChange={setSelectedSpId}>
          <SelectTrigger className="w-full sm:w-[220px] h-9 text-sm bg-slate-50 border-slate-200">
            <SelectValue placeholder={t("Select a strategic plan")} />
          </SelectTrigger>
          <SelectContent className="bg-white" position="popper" sideOffset={4}>
            {strategicPlans.map((sp) => (
              <SelectItem key={sp.id} value={sp.id}>
                {sp.planCode} — {sp.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSp && (
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white" position="popper" sideOffset={4}>
              <SelectItem value="all">{t("All Years")}</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {t("Year")} {y - selectedSp.startYear + 1} · {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedSpId ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          {t("Select a Strategic Plan to view or generate its Operational Plans.")}
        </div>
      ) : loading ? (
        <div className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin inline" />
        </div>
      ) : (
        <div className="space-y-5">
          {visibleYears.map((year) => {
            const plan = opPlans.find((p) => p.year === year);
            const yearLabel = `${t("Year")} ${year - (selectedSp?.startYear ?? year) + 1} · ${year}`;
            return (
              <div key={year} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{yearLabel}</h3>
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
                    {plan && <span className="text-xs text-muted-foreground">{plan.planCode}</span>}
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
                  <p className="px-4 py-4 text-sm text-muted-foreground">
                    {t("No audits in this plan. Use Add Audit to add one.")}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{t("Audit")}</TableHead>
                        <TableHead>{t("Type")}</TableHead>
                        <TableHead>{t("Quarter")}</TableHead>
                        <TableHead>{t("Risk Level")}</TableHead>
                        {canDelete && <TableHead className="text-right">{t("Actions")}</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.items.map((it, idx) => (
                        <TableRow key={it.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{it.title}</TableCell>
                          <TableCell>{it.auditType || "—"}</TableCell>
                          <TableCell>{it.plannedQuarter || "—"}</TableCell>
                          <TableCell>
                            {it.riskLevel ? (
                              <Badge className={riskLevelColor(it.riskLevel)}>{it.riskLevel}</Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          {canDelete && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItem(plan.id, it.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {plan && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <h4 className="text-sm font-semibold mb-2">{t("Quarterly Reports")}</h4>
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

      {/* Delete plan confirm */}
      <AlertDialog open={!!deletePlan} onOpenChange={(o) => !o && setDeletePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Operational Plan")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} {deletePlan?.planCode}? {t("This action cannot be undone.")}
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

export default function OperationalPlanPage() {
  return (
    <Suspense fallback={null}>
      <OperationalPlanContent />
    </Suspense>
  );
}
