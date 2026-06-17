"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  Loader2,
  Home,
  ChevronRight,
  Trash2,
  Download,
  FileText,
  Save,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface Attendee {
  name: string;
  jobTitle: string;
  management: string;
  signature: string;
}

interface RecommendationRow {
  number: string;
  recommendation: string;
  official: string;
  implementationDate: string;
  implementationStatus: string;
  progress: string;
  notes: string;
}

interface FollowUpForm {
  meetingVenue: string;
  history: string;
  assignmentTitle: string;
  auditTaskNumber: string;
  department: string;
  management: string;
  attendees: Attendee[];
  recommendations: RecommendationRow[];
}

const EMPTY_FORM: FollowUpForm = {
  meetingVenue: "",
  history: "",
  assignmentTitle: "",
  auditTaskNumber: "",
  department: "",
  management: "",
  attendees: [],
  recommendations: [],
};

// Defined implementation-status values for tracking recommendation status.
const IMPLEMENTATION_STATUSES = ["Open", "In Progress", "Implemented", "Closed"] as const;

// A recommendation is overdue when its due date has passed and it is not yet
// implemented or closed.
const isOverdue = (r: RecommendationRow): boolean => {
  if (
    !r.implementationDate ||
    r.implementationStatus === "Implemented" ||
    r.implementationStatus === "Closed"
  )
    return false;
  const due = new Date(r.implementationDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
};

export default function FollowUpDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const engagementId = (params?.id as string) || "";
  const { canEdit } = usePermissions("audit.capa");

  const [form, setForm] = useState<FollowUpForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!engagementId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/internal-audit/engagements/${engagementId}/follow-up-meeting`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setForm({
          meetingVenue: data.meetingVenue || "",
          history: data.history || "",
          assignmentTitle: data.assignmentTitle || "",
          auditTaskNumber: data.auditTaskNumber || "",
          department: data.department || "",
          management: data.management || "",
          attendees: Array.isArray(data.attendees) ? data.attendees : [],
          recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        });
      } catch {
        toast.error(t("Failed to load follow-up meeting form"));
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
      const res = await fetch(`/api/internal-audit/engagements/${engagementId}/follow-up-meeting`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Follow-up meeting form saved"));
      return true;
    } catch {
      toast.error(t("Failed to save follow-up meeting form"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!(await save())) return;
    window.open(
      `/api/internal-audit/engagements/${engagementId}/follow-up-meeting/download`,
      "_blank"
    );
  };

  const print = async () => {
    if (!(await save())) return;
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/follow-up-meeting/download`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) w.onload = () => w.print();
    } catch {
      toast.error(t("Failed to print"));
    }
  };

  const addAttendee = () =>
    setForm((p) => ({
      ...p,
      attendees: [...p.attendees, { name: "", jobTitle: "", management: "", signature: "" }],
    }));

  const addRecommendation = () =>
    setForm((p) => ({
      ...p,
      recommendations: [
        ...p.recommendations,
        {
          number: String(p.recommendations.length + 1),
          recommendation: "",
          official: "",
          implementationDate: "",
          implementationStatus: "Open",
          progress: "0",
          notes: "",
        },
      ],
    }));

  const updateAttendee = (idx: number, field: keyof Attendee, value: string) =>
    setForm((p) => {
      const next = [...p.attendees];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, attendees: next };
    });

  const updateRecommendation = (idx: number, field: keyof RecommendationRow, value: string) =>
    setForm((p) => {
      const next = [...p.recommendations];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, recommendations: next };
    });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/follow-up" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Follow-up")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">
          {form.auditTaskNumber || t("Meeting Form")}
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/internal-audit/follow-up">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
              <ArrowLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
            </Button>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
            {t("Follow-up Meeting Form for the Implementation of the Recommendations")}
          </h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Button variant="outline" size="sm" onClick={print} disabled={saving || loading}>
            <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Print")}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={saving || loading}>
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export PDF")}
          </Button>
          {canEdit && (
            <Button size="sm" className="col-span-2 sm:col-span-1" onClick={save} disabled={saving || loading}>
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

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Meeting details */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">{t("Meeting Details")}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 sm:p-5">
              <div>
                <Label className="text-xs text-muted-foreground">{t("Audit Task Number")}</Label>
                <Input
                  value={form.auditTaskNumber}
                  onChange={(e) => setForm((p) => ({ ...p, auditTaskNumber: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("Assignment Title")}</Label>
                <Input
                  value={form.assignmentTitle}
                  onChange={(e) => setForm((p) => ({ ...p, assignmentTitle: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("Department")}</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("Management")}</Label>
                <Input
                  value={form.management}
                  onChange={(e) => setForm((p) => ({ ...p, management: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("Meeting Venue")}</Label>
                <Input
                  value={form.meetingVenue}
                  onChange={(e) => setForm((p) => ({ ...p, meetingVenue: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("History")}</Label>
                <Input
                  value={form.history}
                  onChange={(e) => setForm((p) => ({ ...p, history: e.target.value }))}
                />
              </div>
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
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Job Title")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Management")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Signature")}</TableHead>
                    <TableHead className="w-10" />
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
                              onChange={(e) => updateAttendee(idx, field, e.target.value)}
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
                                attendees: p.attendees.filter((_, i) => i !== idx),
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

          {/* Status of implementation of recommendations */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">
                {t("Status of Implementation of Recommendations")}
              </h3>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={addRecommendation}>
                  <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Add Row")}
                </Button>
              )}
            </div>
            <div className="p-4 sm:p-5">
              {form.recommendations.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 text-xs">
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                    {t("Total")}: {form.recommendations.length}
                  </span>
                  <span className="px-2 py-1 rounded bg-green-100 text-green-700">
                    {t("Implemented")}:{" "}
                    {form.recommendations.filter((r) => r.implementationStatus === "Implemented").length}
                  </span>
                  <span className="px-2 py-1 rounded bg-red-100 text-red-700">
                    {t("Overdue")}: {form.recommendations.filter((r) => isOverdue(r)).length}
                  </span>
                  <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">
                    {t("Avg. Progress")}:{" "}
                    {Math.round(
                      form.recommendations.reduce((sum, r) => sum + (Number(r.progress) || 0), 0) /
                        form.recommendations.length
                    )}
                    %
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="h-11 border-b border-slate-100 bg-slate-50/60 hover:bg-slate-50/60">
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-12 ltr:pl-5 rtl:pr-5">#</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Recommendation")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Official")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Due Date")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Implementation Status")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-28">{t("Progress")}</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Notes")}</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.recommendations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                          {t("No rows. Use Add Row.")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      form.recommendations.map((r, idx) => {
                        const overdue = isOverdue(r);
                        return (
                          <TableRow key={idx} className={overdue ? "bg-red-50" : undefined}>
                            <TableCell>
                              <Input
                                value={r.number}
                                onChange={(e) => updateRecommendation(idx, "number", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                rows={2}
                                value={r.recommendation}
                                onChange={(e) =>
                                  updateRecommendation(idx, "recommendation", e.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={r.official}
                                onChange={(e) => updateRecommendation(idx, "official", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={r.implementationDate}
                                onChange={(e) =>
                                  updateRecommendation(idx, "implementationDate", e.target.value)
                                }
                                className={overdue ? "border-red-400" : undefined}
                              />
                              {overdue && (
                                <span className="text-[10px] font-medium text-red-600">{t("Overdue")}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={r.implementationStatus || "Open"}
                                onValueChange={(v) =>
                                  updateRecommendation(idx, "implementationStatus", v)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {IMPLEMENTATION_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {t(s)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={r.progress ?? ""}
                                  onChange={(e) =>
                                    updateRecommendation(idx, "progress", e.target.value)
                                  }
                                  className="w-16"
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={r.notes}
                                onChange={(e) => updateRecommendation(idx, "notes", e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setForm((p) => ({
                                    ...p,
                                    recommendations: p.recommendations.filter((_, i) => i !== idx),
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
