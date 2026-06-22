"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2, Download, FileText, Save, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProgramRow {
  objective: string;
  processSubprocess: string;
  risk: string;
  control: string;
  controlType: string;
  testType: string;
  auditProcedure: string;
  samplingMethod: string;
  sampleSize: string;
  evidenceRequired: string;
  result: string;
  conclusion: string;
  exception: string;
  workingPaperRef: string;
}

interface AuditProgramForm {
  auditTitle: string;
  department: string;
  period: string;
  instructions: string;
  rows: ProgramRow[];
  preparedBy: string;
  preparedDate: string;
  reviewedBy: string;
  reviewedDate: string;
  approvedBy: string;
  approvedDate: string;
}

const COLUMNS: Array<{ key: keyof ProgramRow; label: string; w: string }> = [
  { key: "objective", label: "Objective", w: "min-w-[140px]" },
  { key: "processSubprocess", label: "Process / Sub-process", w: "min-w-[150px]" },
  { key: "risk", label: "Risk", w: "min-w-[140px]" },
  { key: "control", label: "Control", w: "min-w-[140px]" },
  { key: "controlType", label: "Control Type", w: "min-w-[110px]" },
  { key: "testType", label: "Test Type", w: "min-w-[110px]" },
  { key: "auditProcedure", label: "Audit Procedure", w: "min-w-[170px]" },
  { key: "samplingMethod", label: "Sampling Method", w: "min-w-[120px]" },
  { key: "sampleSize", label: "Sample Size", w: "min-w-[90px]" },
  { key: "evidenceRequired", label: "Evidence Required", w: "min-w-[150px]" },
  { key: "result", label: "Result", w: "min-w-[110px]" },
  { key: "conclusion", label: "Conclusion", w: "min-w-[120px]" },
  { key: "exception", label: "Exception", w: "min-w-[120px]" },
  { key: "workingPaperRef", label: "Working Paper Ref", w: "min-w-[110px]" },
];

const emptyRow = (): ProgramRow =>
  COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: "" }), {} as ProgramRow);

const EMPTY_FORM: AuditProgramForm = {
  auditTitle: "",
  department: "",
  period: "",
  instructions: "",
  rows: [],
  preparedBy: "",
  preparedDate: "",
  reviewedBy: "",
  reviewedDate: "",
  approvedBy: "",
  approvedDate: "",
};

interface AuditProgramProps {
  engagementId: string;
  canEdit: boolean;
}

export default function AuditProgram({ engagementId, canEdit }: AuditProgramProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<AuditProgramForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const baseUrl = `/api/internal-audit/engagements/${engagementId}/audit-program`;

  useEffect(() => {
    if (!engagementId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(baseUrl);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setForm({
          auditTitle: data.auditTitle || "",
          department: data.department || "",
          period: data.period || "",
          instructions: data.instructions || "",
          rows: Array.isArray(data.rows) ? data.rows : [],
          preparedBy: data.preparedBy || "",
          preparedDate: data.preparedDate || "",
          reviewedBy: data.reviewedBy || "",
          reviewedDate: data.reviewedDate || "",
          approvedBy: data.approvedBy || "",
          approvedDate: data.approvedDate || "",
        });
      } catch {
        toast.error(t("Failed to load audit program"));
        setForm(EMPTY_FORM);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(baseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Audit program saved"));
      return true;
    } catch {
      toast.error(t("Failed to save audit program"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!(await save())) return;
    window.open(`${baseUrl}/download`, "_blank");
  };

  const print = async () => {
    if (!(await save())) return;
    try {
      const res = await fetch(`${baseUrl}/download`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) w.onload = () => w.print();
    } catch {
      toast.error(t("Failed to print"));
    }
  };

  const set = <K extends keyof AuditProgramForm>(key: K, value: AuditProgramForm[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const addRow = () => setForm((p) => ({ ...p, rows: [...p.rows, emptyRow()] }));
  const updateRow = (idx: number, key: keyof ProgramRow, value: string) =>
    setForm((p) => {
      const next = [...p.rows];
      next[idx] = { ...next[idx], [key]: value };
      return { ...p, rows: next };
    });
  const removeRow = (idx: number) =>
    setForm((p) => ({ ...p, rows: p.rows.filter((_, i) => i !== idx) }));

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  const head = "text-xs font-medium text-slate-500 uppercase tracking-wider py-2 px-2 text-left whitespace-nowrap";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <FileText className="h-5 w-5 text-slate-500" />
          {t("Audit Program")}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={saving}>
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export PDF")}
          </Button>
          {canEdit && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              )}
              {t("Save")}
            </Button>
          )}
        </div>
      </div>

      {/* A. Audit Program Overview */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("A. Audit Program Overview")}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 sm:p-5">
          {(
            [
              ["auditTitle", "Audit Title"],
              ["department", "Department"],
              ["period", "Period"],
            ] as Array<[keyof AuditProgramForm, string]>
          ).map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground">{t(label)}</Label>
              <Input
                value={form[key] as string}
                disabled={!canEdit}
                onChange={(e) => set(key, e.target.value as AuditProgramForm[typeof key])}
              />
            </div>
          ))}
        </div>
      </div>

      {/* B. Instructions */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("B. Instructions")}</h3>
        </div>
        <div className="p-4 sm:p-5">
          <Textarea
            rows={3}
            value={form.instructions}
            disabled={!canEdit}
            onChange={(e) => set("instructions", e.target.value)}
          />
        </div>
      </div>

      {/* C. Detailed Audit Program */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("C. Detailed Audit Program")}</h3>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Row")}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className={`${head} w-10 ltr:pl-4 rtl:pr-4`}>#</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`${head} ${c.w}`}>
                    {t(c.label)}
                  </th>
                ))}
                {canEdit && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {form.rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="text-center py-6 text-sm text-slate-400">
                    {t("No rows. Use Add Row.")}
                  </td>
                </tr>
              ) : (
                form.rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="py-2 px-2 text-sm text-slate-500 ltr:pl-4 rtl:pr-4">{idx + 1}</td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="py-1.5 px-1">
                        <Textarea
                          rows={2}
                          className={`text-xs min-h-[40px] ${c.w}`}
                          value={row[c.key]}
                          disabled={!canEdit}
                          onChange={(e) => updateRow(idx, c.key, e.target.value)}
                        />
                      </td>
                    ))}
                    {canEdit && (
                      <td className="py-1.5 px-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* D. Review & Approval */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("D. Review & Approval")}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-5">
          {(
            [
              ["preparedBy", "Prepared by", "preparedDate"],
              ["reviewedBy", "Reviewed by", "reviewedDate"],
              ["approvedBy", "Approved by", "approvedDate"],
            ] as Array<[keyof AuditProgramForm, string, keyof AuditProgramForm]>
          ).map(([nameKey, label, dateKey]) => (
            <div key={nameKey} className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t(label)}</Label>
                <Input
                  value={form[nameKey] as string}
                  disabled={!canEdit}
                  onChange={(e) => set(nameKey, e.target.value as AuditProgramForm[typeof nameKey])}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("Date")}</Label>
                <Input
                  type="date"
                  value={form[dateKey] as string}
                  disabled={!canEdit}
                  onChange={(e) => set(dateKey, e.target.value as AuditProgramForm[typeof dateKey])}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 sm:px-5 pb-4 text-xs text-slate-400 space-y-0.5">
          <p>• {t("All procedures must be executed and documented.")}</p>
          <p>• {t("Exceptions must be supported by evidence.")}</p>
          <p>• {t("Working papers must be referenced.")}</p>
          <p>• {t("Any deviation from plan must be justified.")}</p>
        </div>
      </div>
    </div>
  );
}
