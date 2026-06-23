"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Home,
  ChevronRight,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface Declaration {
  id: string;
  declarationCode: string;
  type: string;
  declarantName: string | null;
  position: string | null;
  department: string | null;
  engagement: string | null;
  declarationDate: string | null;
  result: string | null;
  explanation: string | null;
  employeeSignature: string | null;
  reviewerName: string | null;
  reviewerSignature: string | null;
  reviewedDate: string | null;
  status: string;
  createdAt: string;
}

// Fixed declaration statements (from the IIA-aligned declaration forms).
const STATEMENTS: Record<string, string[]> = {
  Independence: [
    "I have no personal, financial, or professional interests that could impair my independence.",
    "I have not been involved in operational responsibilities related to the audited area during the past 12 months.",
    "I have no close relationships with personnel working in the audited department that may affect my impartiality.",
    "I will immediately disclose any situation that may arise which could affect my independence.",
  ],
  Objectivity: [
    "I will conduct the audit without bias, conflict of interest, or undue influence.",
    "My conclusions will be based solely on sufficient and appropriate audit evidence.",
    "I will disclose any circumstances that may affect my professional judgment.",
    "I will adhere to the Code of Ethics and Objectivity principles established by The Institute of Internal Auditors.",
  ],
};

// Result options per type: value -> label
const RESULTS: Record<string, { value: string; label: string }[]> = {
  Independence: [
    { value: "Confirmed", label: "I confirm full independence" },
    { value: "PotentialImpairment", label: "Potential impairment exists" },
  ],
  Objectivity: [
    { value: "NoThreats", label: "No threats to objectivity identified" },
    { value: "PotentialThreat", label: "Potential threat identified" },
  ],
};

const EMPTY = {
  type: "Independence",
  declarantName: "",
  position: "",
  department: "",
  engagement: "",
  declarationDate: "",
  result: "",
  explanation: "",
  employeeSignature: "",
  reviewerName: "",
  reviewerSignature: "",
  status: "Draft",
};

export default function IndependencePage() {
  const { t } = useLanguage();
  const { canCreate, canEdit, canDelete } = usePermissions("audit.independence");
  const isReviewer = useHasRole("AuditHead") || useHasRole("AuditManager");

  const [loading, setLoading] = useState(true);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/internal-audit/declarations");
      if (res.ok) setDeclarations(await res.json());
    } catch {
      toast.error(t("Failed to load declarations"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setReadOnly(false);
    setForm({ ...EMPTY, declarationDate: new Date().toISOString().slice(0, 10) });
    setDialogOpen(true);
  };

  const openEdit = (d: Declaration, ro: boolean) => {
    setEditingId(d.id);
    setReadOnly(ro);
    setForm({
      type: d.type,
      declarantName: d.declarantName || "",
      position: d.position || "",
      department: d.department || "",
      engagement: d.engagement || "",
      declarationDate: d.declarationDate ? d.declarationDate.slice(0, 10) : "",
      result: d.result || "",
      explanation: d.explanation || "",
      employeeSignature: d.employeeSignature || "",
      reviewerName: d.reviewerName || "",
      reviewerSignature: d.reviewerSignature || "",
      status: d.status,
    });
    setDialogOpen(true);
  };

  const submit = async (status: string) => {
    if (!form.declarantName.trim()) {
      toast.error(t("Name is required"));
      return;
    }
    if (!form.result) {
      toast.error(t("Please select a declaration result"));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, status };
      const res = await fetch(
        editingId ? `/api/internal-audit/declarations/${editingId}` : "/api/internal-audit/declarations",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error();
      toast.success(t("Declaration saved"));
      setDialogOpen(false);
      await load();
    } catch {
      toast.error(t("Failed to save declaration"));
    } finally {
      setSaving(false);
    }
  };

  const markReviewed = async () => {
    if (!form.reviewerName.trim()) {
      toast.error(t("Reviewer name is required"));
      return;
    }
    await submit("Reviewed");
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/internal-audit/declarations/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("Declaration deleted"));
      setDeleteId(null);
      await load();
    } catch {
      toast.error(t("Failed to delete declaration"));
    }
  };

  const statusBadge = (s: string) => {
    const cls =
      s === "Reviewed" ? "bg-green-50 text-green-700"
      : s === "Submitted" ? "bg-blue-50 text-blue-700"
      : "bg-amber-50 text-amber-700";
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{t(s)}</span>;
  };

  const resultLabel = (type: string, value: string | null) => {
    if (!value) return "-";
    const found = RESULTS[type]?.find((r) => r.value === value);
    return found ? t(found.label) : value;
  };

  const filtered = declarations.filter((d) => {
    const matchesType = typeFilter === "all" || d.type === typeFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (d.declarantName || "").toLowerCase().includes(q) ||
      (d.engagement || "").toLowerCase().includes(q) ||
      d.declarationCode.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const statements = STATEMENTS[form.type] || [];
  const results = RESULTS[form.type] || [];
  const showExplanation = form.result === "PotentialImpairment" || form.result === "PotentialThreat";
  const canReviewThis = isReviewer && editingId && !readOnly;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Independence & Objectivity")}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary-600" />
            {t("Independence & Objectivity")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("Auditor independence and objectivity declarations per the Global Internal Audit Standards.")}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openNew} className="bg-primary-600 hover:bg-primary-700">
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("New Declaration")}
          </Button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-1">
            {["all", "Independence", "Objectivity"].map((tb) => (
              <button
                key={tb}
                onClick={() => setTypeFilter(tb)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === tb ? "bg-primary-50 text-primary-700" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {t(tb === "all" ? "All" : tb)}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
              <ShieldCheck className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">{t("No declarations yet")}</p>
            {canCreate && <p className="text-xs text-slate-500 mt-1">{t("Use New Declaration to add one.")}</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-50/60">
                <tr className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="ltr:text-left rtl:text-right py-3 ltr:pl-5 rtl:pr-5">{t("Code")}</th>
                  <th className="ltr:text-left rtl:text-right py-3">{t("Type")}</th>
                  <th className="ltr:text-left rtl:text-right py-3">{t("Name")}</th>
                  <th className="ltr:text-left rtl:text-right py-3">{t("Audit Engagement")}</th>
                  <th className="ltr:text-left rtl:text-right py-3">{t("Date")}</th>
                  <th className="ltr:text-left rtl:text-right py-3">{t("Result")}</th>
                  <th className="ltr:text-left rtl:text-right py-3">{t("Status")}</th>
                  <th className="ltr:text-right rtl:text-left py-3 ltr:pr-5 rtl:pl-5">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="py-3 ltr:pl-5 rtl:pr-5 font-medium text-slate-700">{d.declarationCode}</td>
                    <td className="py-3">{t(d.type)}</td>
                    <td className="py-3 text-slate-700">{d.declarantName || "-"}</td>
                    <td className="py-3 text-slate-600 max-w-[200px] truncate">{d.engagement || "-"}</td>
                    <td className="py-3 text-slate-600 whitespace-nowrap">{d.declarationDate ? d.declarationDate.slice(0, 10) : "-"}</td>
                    <td className="py-3 text-slate-600">{resultLabel(d.type, d.result)}</td>
                    <td className="py-3">{statusBadge(d.status)}</td>
                    <td className="py-3 ltr:pr-5 rtl:pl-5">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title={t("View")} onClick={() => openEdit(d, true)}>
                          <Search className="h-4 w-4 text-slate-400" />
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title={t("Edit")} onClick={() => openEdit(d, false)}>
                            <Pencil className="h-4 w-4 text-slate-400" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600" title={t("Delete")} onClick={() => setDeleteId(d.id)}>
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit / View dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {readOnly ? t("View Declaration") : editingId ? t("Edit Declaration") : t("New Declaration")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Type */}
            <div>
              <Label className="text-xs text-slate-500">{t("Declaration Type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v, result: "" }))} disabled={!!editingId || readOnly}>
                <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Independence">{t("Independence Declaration")}</SelectItem>
                  <SelectItem value="Objectivity">{t("Objectivity Declaration")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Employee info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500">{t("Name")} *</Label>
                <Input className="mt-1" value={form.declarantName} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, declarantName: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">{t("Position")}</Label>
                <Input className="mt-1" value={form.position} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} />
              </div>
              {form.type === "Independence" && (
                <div>
                  <Label className="text-xs text-slate-500">{t("Department")}</Label>
                  <Input className="mt-1" value={form.department} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
                </div>
              )}
              <div>
                <Label className="text-xs text-slate-500">{t("Audit Engagement")} / {t("Project")}</Label>
                <Input className="mt-1" value={form.engagement} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, engagement: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-slate-500">{t("Date")}</Label>
                <Input type="date" className="mt-1" value={form.declarationDate} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, declarationDate: e.target.value }))} />
              </div>
            </div>

            {/* Declaration statements (read-only) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700 mb-2">
                {form.type === "Independence"
                  ? t("I hereby declare that I am independent with respect to the activities, departments, and processes subject to this audit engagement. I confirm that:")
                  : t("I confirm that I will perform this audit engagement with full objectivity and professional judgment. I declare that:")}
              </p>
              <ul className="space-y-1.5">
                {statements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    {t(s)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Result */}
            <div>
              <Label className="text-xs text-slate-500">
                {form.type === "Independence" ? t("Declaration Result") : t("Objectivity Assessment")} *
              </Label>
              <RadioGroup value={form.result} onValueChange={(v) => setForm((p) => ({ ...p, result: v }))} className="mt-2 space-y-2" disabled={readOnly}>
                {results.map((r) => (
                  <div key={r.value} className="flex items-center gap-2">
                    <RadioGroupItem value={r.value} id={`res-${r.value}`} disabled={readOnly} />
                    <Label htmlFor={`res-${r.value}`} className="font-normal cursor-pointer">{t(r.label)}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {showExplanation && (
              <div>
                <Label className="text-xs text-slate-500">{t("Explanation")}</Label>
                <Textarea className="mt-1" rows={3} value={form.explanation} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, explanation: e.target.value }))} />
              </div>
            )}

            {/* Signature */}
            <div>
              <Label className="text-xs text-slate-500">
                {form.type === "Independence" ? t("Employee Signature") : t("Internal Auditor Signature")}
              </Label>
              <Input className="mt-1" placeholder={t("Type your full name")} value={form.employeeSignature} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, employeeSignature: e.target.value }))} />
            </div>

            {/* Reviewer / approval */}
            {(canReviewThis || form.reviewerName) && (
              <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                <p className="text-sm font-semibold text-slate-700">
                  {form.type === "Independence" ? t("Reviewed by (Chief Audit Executive / Audit Manager)") : t("Approved by (Audit Manager)")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">{t("Reviewer Name")}</Label>
                    <Input className="mt-1" value={form.reviewerName} disabled={readOnly || !canReviewThis} onChange={(e) => setForm((p) => ({ ...p, reviewerName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">{t("Reviewer Signature")}</Label>
                    <Input className="mt-1" value={form.reviewerSignature} disabled={readOnly || !canReviewThis} onChange={(e) => setForm((p) => ({ ...p, reviewerSignature: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {!readOnly && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{t("Cancel")}</Button>
              <Button variant="outline" onClick={() => submit("Draft")} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Save Draft")}
              </Button>
              {canReviewThis ? (
                <Button className="bg-green-600 hover:bg-green-700" onClick={markReviewed} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />}
                  {t("Mark Reviewed")}
                </Button>
              ) : (
                <Button className="bg-primary-600 hover:bg-primary-700" onClick={() => submit("Submitted")} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" /> : null}
                  {t("Submit")}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("Delete Declaration")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">{t("Are you sure you want to delete this declaration? This action cannot be undone.")}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t("Cancel")}</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>{t("Delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
