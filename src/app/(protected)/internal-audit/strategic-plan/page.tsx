"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Eye,
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

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error(t("Please enter a plan title"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/internal-audit/strategic-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
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
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span>{t("Internal Audit")}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{t("Strategic Plan")}</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarRange className="h-6 w-6" />
            {t("Strategic Audit Plan")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Multi-year, risk-based audit strategy")}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("Create Strategic Plan")}
          </Button>
        )}
      </div>

      {/* List */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Code")}</TableHead>
              <TableHead>{t("Title")}</TableHead>
              <TableHead>{t("Duration")}</TableHead>
              <TableHead>{t("Period")}</TableHead>
              <TableHead>{t("Audits")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead>{t("Created By")}</TableHead>
              <TableHead className="text-right">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t("No strategic plans yet")}
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow
                  key={plan.id}
                  className={plan.status === "Approved" ? "bg-green-50/60" : ""}
                >
                  <TableCell className="font-medium">{plan.planCode}</TableCell>
                  <TableCell>{plan.title}</TableCell>
                  <TableCell>{plan.durationYears} {t("Years")}</TableCell>
                  <TableCell>
                    {plan.startYear}–{plan.startYear + plan.durationYears - 1}
                  </TableCell>
                  <TableCell>{plan._count?.items ?? 0}</TableCell>
                  <TableCell>
                    <Badge className={statusColor(plan.status)}>
                      {plan.status === "Approved" && (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      {t(plan.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{plan.createdBy?.fullName || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openView(plan.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canDelete && plan.status !== "Approved" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(plan)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Create Strategic Plan")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Plan Title")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("e.g. 3-Year Internal Audit Strategy")}
              />
            </div>
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
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
              <Checkbox
                id="genrisk"
                checked={form.generateFromRisk}
                onCheckedChange={(c) =>
                  setForm({ ...form, generateFromRisk: !!c })
                }
              />
              <div className="space-y-0.5">
                <Label htmlFor="genrisk" className="cursor-pointer">
                  {t("Generate from Risk Register")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("Populate the plan from the risk register, ranked by residual risk. Highest-risk audits are scheduled in the earliest years.")}
                </p>
              </div>
            </div>
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
                                  <TableCell>{it.auditType || "—"}</TableCell>
                                  <TableCell>
                                    {it.riskLevel ? (
                                      <Badge className={riskLevelColor(it.riskLevel)}>
                                        {it.riskLevel}
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
