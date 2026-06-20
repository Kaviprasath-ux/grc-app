"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Trash2, FileText, Save, Plus, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Attendee {
  name: string;
  jobTitle: string;
  management: string;
  signature: string;
}
interface SummaryRow {
  number: string;
  keyNote: string;
  degreeOfRisk: string;
  recommendation: string;
  managementResponse: string;
}
interface DecisionRow {
  implementationDate: string;
  official: string;
  decision: string;
}
interface ClosingForm {
  meetingVenue: string;
  history: string;
  assignmentTitle: string;
  auditTaskNumber: string;
  department: string;
  management: string;
  attendees: Attendee[];
  summary: SummaryRow[];
  decisions: DecisionRow[];
}

const EMPTY_FORM: ClosingForm = {
  meetingVenue: "",
  history: "",
  assignmentTitle: "",
  auditTaskNumber: "",
  department: "",
  management: "",
  attendees: [],
  summary: [],
  decisions: [],
};

export default function ClosingMeeting({
  engagementId,
  canEdit,
}: {
  engagementId: string;
  canEdit: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<ClosingForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const base = `/api/internal-audit/engagements/${engagementId}/closing-meeting`;
  const headHd = "text-xs font-medium text-slate-500 uppercase tracking-wider py-3";

  useEffect(() => {
    if (!engagementId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(base);
        if (!res.ok) throw new Error("Failed");
        const d = await res.json();
        if (d) {
          setForm({
            meetingVenue: d.meetingVenue || "",
            history: d.history || "",
            assignmentTitle: d.assignmentTitle || "",
            auditTaskNumber: d.auditTaskNumber || "",
            department: d.department || "",
            management: d.management || "",
            attendees: Array.isArray(d.attendees) ? d.attendees : [],
            summary: Array.isArray(d.summary) ? d.summary : [],
            decisions: Array.isArray(d.decisions) ? d.decisions : [],
          });
        }
      } catch {
        toast.error(t("Failed to load closing meeting"));
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
      const res = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Closing meeting minutes saved"));
      return true;
    } catch {
      toast.error(t("Failed to save closing meeting minutes"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!(await save())) return;
    window.open(`${base}/download`, "_blank");
  };

  const print = async () => {
    if (!(await save())) return;
    try {
      const res = await fetch(`${base}/download`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) w.onload = () => w.print();
    } catch {
      toast.error(t("Failed to print"));
    }
  };

  // --- Row helpers ---
  const addAttendee = () =>
    setForm((p) => ({
      ...p,
      attendees: [...p.attendees, { name: "", jobTitle: "", management: "", signature: "" }],
    }));
  const updateAttendee = (idx: number, field: keyof Attendee, value: string) =>
    setForm((p) => {
      const next = [...p.attendees];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, attendees: next };
    });

  const addSummary = () =>
    setForm((p) => ({
      ...p,
      summary: [
        ...p.summary,
        {
          number: String(p.summary.length + 1),
          keyNote: "",
          degreeOfRisk: "",
          recommendation: "",
          managementResponse: "",
        },
      ],
    }));
  const updateSummary = (idx: number, field: keyof SummaryRow, value: string) =>
    setForm((p) => {
      const next = [...p.summary];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, summary: next };
    });

  const addDecision = () =>
    setForm((p) => ({
      ...p,
      decisions: [...p.decisions, { implementationDate: "", official: "", decision: "" }],
    }));
  const updateDecision = (idx: number, field: keyof DecisionRow, value: string) =>
    setForm((p) => {
      const next = [...p.decisions];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, decisions: next };
    });

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <FileText className="h-5 w-5 text-slate-500" />
          {t("Closing Meeting Minutes")}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={print} disabled={saving}>
            <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Print")}
          </Button>
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

      {/* Meeting details */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("Meeting Details")}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 sm:p-5">
          {(
            [
              ["management", "Management"],
              ["department", "Department"],
              ["auditTaskNumber", "Audit Task Number"],
              ["assignmentTitle", "Assignment Title"],
              ["history", "History"],
              ["meetingVenue", "Meeting Venue"],
            ] as Array<[keyof ClosingForm, string]>
          ).map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground">{t(label)}</Label>
              <Input
                value={form[key] as string}
                disabled={!canEdit}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Attendees */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("Attendees")}</h3>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addAttendee}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Row")}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className={`${headHd} ltr:pl-5 rtl:pr-5`}>{t("Name")}</TableHead>
                <TableHead className={headHd}>{t("Job Title")}</TableHead>
                <TableHead className={headHd}>{t("Management")}</TableHead>
                <TableHead className={headHd}>{t("Signature")}</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.attendees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.attendees.map((a, idx) => (
                  <TableRow key={idx}>
                    {(["name", "jobTitle", "management", "signature"] as const).map((field) => (
                      <TableCell key={field}>
                        <Input
                          value={a[field]}
                          disabled={!canEdit}
                          onChange={(e) => updateAttendee(idx, field, e.target.value)}
                        />
                      </TableCell>
                    ))}
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              attendees: p.attendees.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary of Audit Results */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("Summary of Audit Results")}</h3>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addSummary}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Row")}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className={`${headHd} w-12 ltr:pl-5 rtl:pr-5`}>#</TableHead>
                <TableHead className={headHd}>{t("Key Note")}</TableHead>
                <TableHead className={headHd}>{t("Degree of Risk")}</TableHead>
                <TableHead className={headHd}>{t("Recommendation")}</TableHead>
                <TableHead className={headHd}>{t("Management Response")}</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.summary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.summary.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={row.number}
                        disabled={!canEdit}
                        onChange={(e) => updateSummary(idx, "number", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.keyNote}
                        disabled={!canEdit}
                        onChange={(e) => updateSummary(idx, "keyNote", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.degreeOfRisk}
                        disabled={!canEdit}
                        onChange={(e) => updateSummary(idx, "degreeOfRisk", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.recommendation}
                        disabled={!canEdit}
                        onChange={(e) => updateSummary(idx, "recommendation", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.managementResponse}
                        disabled={!canEdit}
                        onChange={(e) => updateSummary(idx, "managementResponse", e.target.value)}
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              summary: p.summary.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Decisions taken */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("Decisions taken")}</h3>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addDecision}>
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Row")}
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[620px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
                <TableHead className={`${headHd} ltr:pl-5 rtl:pr-5`}>{t("Implementation Date")}</TableHead>
                <TableHead className={headHd}>{t("Official")}</TableHead>
                <TableHead className={headHd}>{t("Decision")}</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.decisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.decisions.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        type="date"
                        value={row.implementationDate}
                        disabled={!canEdit}
                        onChange={(e) => updateDecision(idx, "implementationDate", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.official}
                        disabled={!canEdit}
                        onChange={(e) => updateDecision(idx, "official", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.decision}
                        disabled={!canEdit}
                        onChange={(e) => updateDecision(idx, "decision", e.target.value)}
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              decisions: p.decisions.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
