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
interface NoteRow {
  number: string;
  note: string;
  degreeOfRisk: string;
  managementResponse: string;
  proposedAction: string;
}
interface ActionRow {
  implementationDate: string;
  official: string;
  procedure: string;
}
interface FDForm {
  meetingVenue: string;
  history: string;
  assignmentTitle: string;
  auditTaskNumber: string;
  department: string;
  management: string;
  attendees: Attendee[];
  notesDiscussed: NoteRow[];
  agreedActions: ActionRow[];
}

const EMPTY_FORM: FDForm = {
  meetingVenue: "",
  history: "",
  assignmentTitle: "",
  auditTaskNumber: "",
  department: "",
  management: "",
  attendees: [],
  notesDiscussed: [],
  agreedActions: [],
};

export default function FindingsDiscussionMeeting({
  engagementId,
  canEdit,
}: {
  engagementId: string;
  canEdit: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FDForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const base = `/api/internal-audit/engagements/${engagementId}/findings-discussion-meeting`;
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
            notesDiscussed: Array.isArray(d.notesDiscussed) ? d.notesDiscussed : [],
            agreedActions: Array.isArray(d.agreedActions) ? d.agreedActions : [],
          });
        }
      } catch {
        toast.error(t("Failed to load findings discussion"));
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
      toast.success(t("Findings discussion minutes saved"));
      return true;
    } catch {
      toast.error(t("Failed to save findings discussion minutes"));
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

  const addNote = () =>
    setForm((p) => ({
      ...p,
      notesDiscussed: [
        ...p.notesDiscussed,
        {
          number: String(p.notesDiscussed.length + 1),
          note: "",
          degreeOfRisk: "",
          managementResponse: "",
          proposedAction: "",
        },
      ],
    }));
  const updateNote = (idx: number, field: keyof NoteRow, value: string) =>
    setForm((p) => {
      const next = [...p.notesDiscussed];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, notesDiscussed: next };
    });

  const addAction = () =>
    setForm((p) => ({
      ...p,
      agreedActions: [...p.agreedActions, { implementationDate: "", official: "", procedure: "" }],
    }));
  const updateAction = (idx: number, field: keyof ActionRow, value: string) =>
    setForm((p) => {
      const next = [...p.agreedActions];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, agreedActions: next };
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
          {t("Findings Discussion Meeting Minutes")}
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
            ] as Array<[keyof FDForm, string]>
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

      {/* Notes discussed */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("Notes Discussed")}</h3>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addNote}>
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
                <TableHead className={headHd}>{t("Note")}</TableHead>
                <TableHead className={headHd}>{t("Degree of Risk")}</TableHead>
                <TableHead className={headHd}>{t("Management Response")}</TableHead>
                <TableHead className={headHd}>{t("Proposed Action")}</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.notesDiscussed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.notesDiscussed.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={row.number}
                        disabled={!canEdit}
                        onChange={(e) => updateNote(idx, "number", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.note}
                        disabled={!canEdit}
                        onChange={(e) => updateNote(idx, "note", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.degreeOfRisk}
                        disabled={!canEdit}
                        onChange={(e) => updateNote(idx, "degreeOfRisk", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.managementResponse}
                        disabled={!canEdit}
                        onChange={(e) => updateNote(idx, "managementResponse", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.proposedAction}
                        disabled={!canEdit}
                        onChange={(e) => updateNote(idx, "proposedAction", e.target.value)}
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
                              notesDiscussed: p.notesDiscussed.filter((_, i) => i !== idx),
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

      {/* Agreed actions */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">{t("Agreed Actions")}</h3>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={addAction}>
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
                <TableHead className={headHd}>{t("Procedure")}</TableHead>
                {canEdit && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.agreedActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.agreedActions.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        type="date"
                        value={row.implementationDate}
                        disabled={!canEdit}
                        onChange={(e) => updateAction(idx, "implementationDate", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.official}
                        disabled={!canEdit}
                        onChange={(e) => updateAction(idx, "official", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={row.procedure}
                        disabled={!canEdit}
                        onChange={(e) => updateAction(idx, "procedure", e.target.value)}
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
                              agreedActions: p.agreedActions.filter((_, i) => i !== idx),
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
