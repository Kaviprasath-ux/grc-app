"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Trash2, Download, FileText, Save, Plus } from "lucide-react";
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
  number: string;
  procedure: string;
  official: string;
  implementationDate: string;
}
interface FormState {
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

const EMPTY: FormState = {
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

const HEADER_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: "meetingVenue", label: "Meeting Venue" },
  { key: "history", label: "History" },
  { key: "assignmentTitle", label: "Assignment Title" },
  { key: "auditTaskNumber", label: "Audit Task Number" },
  { key: "department", label: "Department" },
  { key: "management", label: "Management" },
];

export default function FindingsDiscussionMeeting({
  engagementId,
  canEdit,
}: {
  engagementId: string;
  canEdit: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/internal-audit/engagements/${engagementId}/findings-discussion-meeting`
        );
        if (!res.ok) throw new Error("Failed");
        const d = await res.json();
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
      } catch {
        toast.error(t("Failed to load meeting form"));
        setForm(EMPTY);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/findings-discussion-meeting`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Meeting form saved"));
      return true;
    } catch {
      toast.error(t("Failed to save meeting form"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!(await save())) return;
    window.open(
      `/api/internal-audit/engagements/${engagementId}/findings-discussion-meeting/download`,
      "_blank"
    );
  };

  const print = async () => {
    if (!(await save())) return;
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/findings-discussion-meeting/download`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) w.onload = () => w.print();
    } catch {
      toast.error(t("Failed to print"));
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  const headTh = "text-xs font-medium text-slate-500 uppercase tracking-wider py-2";

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex flex-wrap ltr:justify-end rtl:justify-start gap-2">
        <Button variant="outline" size="sm" onClick={print} disabled={saving}>
          <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Print")}
        </Button>
        <Button variant="outline" size="sm" onClick={exportPdf} disabled={saving}>
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export PDF")}
        </Button>
        {canEdit && (
          <Button size="sm" className="bg-primary-600 hover:bg-primary-700" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            )}
            {t("Save")}
          </Button>
        )}
      </div>

      {/* Header table */}
      <div className="rounded-lg border border-slate-200 overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {HEADER_FIELDS.map((h) => (
                <TableHead key={h.key} className={headTh}>{t(h.label)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {HEADER_FIELDS.map((h) => (
                <TableCell key={h.key}>
                  <Input
                    value={form[h.key] as string}
                    onChange={(e) => setForm((p) => ({ ...p, [h.key]: e.target.value }))}
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Attendees */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">{t("Attendees")}</h4>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  attendees: [...p.attendees, { name: "", jobTitle: "", management: "", signature: "" }],
                }))
              }
            >
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Row")}
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className={headTh}>{t("Name")}</TableHead>
                <TableHead className={headTh}>{t("Job Title")}</TableHead>
                <TableHead className={headTh}>{t("Management")}</TableHead>
                <TableHead className={headTh}>{t("Signature")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.attendees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-slate-400">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.attendees.map((a, idx) => (
                  <TableRow key={idx}>
                    {(["name", "jobTitle", "management", "signature"] as const).map((f) => (
                      <TableCell key={f}>
                        <Input
                          value={a[f]}
                          onChange={(e) =>
                            setForm((p) => {
                              const next = [...p.attendees];
                              next[idx] = { ...next[idx], [f]: e.target.value };
                              return { ...p, attendees: next };
                            })
                          }
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm((p) => ({ ...p, attendees: p.attendees.filter((_, i) => i !== idx) }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Notes Discussed */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">{t("Notes Discussed")}</h4>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
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
                }))
              }
            >
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Row")}
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className={`${headTh} w-12`}>#</TableHead>
                <TableHead className={headTh}>{t("Note")}</TableHead>
                <TableHead className={headTh}>{t("Degree of Risk")}</TableHead>
                <TableHead className={headTh}>{t("Management Response")}</TableHead>
                <TableHead className={headTh}>{t("Proposed Action")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.notesDiscussed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-slate-400">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.notesDiscussed.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={r.number}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.notesDiscussed];
                            next[idx] = { ...next[idx], number: e.target.value };
                            return { ...p, notesDiscussed: next };
                          })
                        }
                      />
                    </TableCell>
                    {(["note", "degreeOfRisk", "managementResponse", "proposedAction"] as const).map((f) => (
                      <TableCell key={f}>
                        <Textarea
                          rows={2}
                          value={r[f]}
                          onChange={(e) =>
                            setForm((p) => {
                              const next = [...p.notesDiscussed];
                              next[idx] = { ...next[idx], [f]: e.target.value };
                              return { ...p, notesDiscussed: next };
                            })
                          }
                        />
                      </TableCell>
                    ))}
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Agreed Actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">{t("Agreed Actions")}</h4>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  agreedActions: [
                    ...p.agreedActions,
                    {
                      number: String(p.agreedActions.length + 1),
                      procedure: "",
                      official: "",
                      implementationDate: "",
                    },
                  ],
                }))
              }
            >
              <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Add Row")}
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className={`${headTh} w-12`}>#</TableHead>
                <TableHead className={headTh}>{t("Procedure")}</TableHead>
                <TableHead className={headTh}>{t("Official")}</TableHead>
                <TableHead className={headTh}>{t("Implementation Date")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.agreedActions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-slate-400">
                    {t("No rows. Use Add Row.")}
                  </TableCell>
                </TableRow>
              ) : (
                form.agreedActions.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        value={r.number}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.agreedActions];
                            next[idx] = { ...next[idx], number: e.target.value };
                            return { ...p, agreedActions: next };
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={r.procedure}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.agreedActions];
                            next[idx] = { ...next[idx], procedure: e.target.value };
                            return { ...p, agreedActions: next };
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={r.official}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.agreedActions];
                            next[idx] = { ...next[idx], official: e.target.value };
                            return { ...p, agreedActions: next };
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={r.implementationDate}
                        onChange={(e) =>
                          setForm((p) => {
                            const next = [...p.agreedActions];
                            next[idx] = { ...next[idx], implementationDate: e.target.value };
                            return { ...p, agreedActions: next };
                          })
                        }
                      />
                    </TableCell>
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
