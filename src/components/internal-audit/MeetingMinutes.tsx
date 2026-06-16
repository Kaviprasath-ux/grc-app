"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Loader2,
  FileText,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocalDate } from "@/lib/utils";

interface Meeting {
  id: string;
  meetingType: string;
  title: string | null;
  meetingDate: string | null;
  location: string | null;
  attendees: string | null;
  agenda: string | null;
  minutes: string | null;
  decisions: string | null;
  status: string;
  createdByName: string | null;
  createdAt: string;
}

interface MeetingMinutesProps {
  engagementId: string;
  meetingType: "opening" | "discussion" | "closing";
  canEdit: boolean;
}

interface MeetingFormState {
  title: string;
  meetingDate: string;
  location: string;
  attendees: string;
  agenda: string;
  minutes: string;
  decisions: string;
  status: string;
}

const emptyForm: MeetingFormState = {
  title: "",
  meetingDate: "",
  location: "",
  attendees: "",
  agenda: "",
  minutes: "",
  decisions: "",
  status: "Draft",
};

export default function MeetingMinutes({
  engagementId,
  meetingType,
  canEdit,
}: MeetingMinutesProps) {
  const { t } = useLanguage();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState<MeetingFormState>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const meetingTypeLabel = useCallback(
    (type: string): string => {
      switch (type) {
        case "opening":
          return t("Opening Meeting");
        case "discussion":
          return t("Findings Discussion");
        case "closing":
          return t("Closing Meeting");
        default:
          return t("Meeting");
      }
    },
    [t]
  );

  const formatDate = useCallback((iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }, []);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/meetings?type=${meetingType}`
      );
      if (!res.ok) throw new Error("Failed");
      const data: Meeting[] = await res.json();
      setMeetings(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t("Failed to load meeting minutes"));
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [engagementId, meetingType, t]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setEditing(m);
    setForm({
      title: m.title ?? "",
      meetingDate: m.meetingDate ? m.meetingDate.slice(0, 10) : "",
      location: m.location ?? "",
      attendees: m.attendees ?? "",
      agenda: m.agenda ?? "",
      minutes: m.minutes ?? "",
      decisions: m.decisions ?? "",
      status: m.status || "Draft",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        meetingType,
        title: form.title.trim() || null,
        meetingDate: form.meetingDate || null,
        location: form.location.trim() || null,
        attendees: form.attendees.trim() || null,
        agenda: form.agenda.trim() || null,
        minutes: form.minutes.trim() || null,
        decisions: form.decisions.trim() || null,
        status: form.status,
      };

      const url = editing
        ? `/api/internal-audit/engagements/${engagementId}/meetings/${editing.id}`
        : `/api/internal-audit/engagements/${engagementId}/meetings`;
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");

      toast.success(editing ? t("Minutes updated") : t("Minutes added"));
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadMeetings();
    } catch {
      toast.error(t("Failed to save minutes"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/internal-audit/engagements/${engagementId}/meetings/${deleteTarget.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Minutes deleted"));
      setDeleteTarget(null);
      await loadMeetings();
    } catch {
      toast.error(t("Failed to delete minutes"));
    } finally {
      setDeleting(false);
    }
  };

  const statusBadgeClass = (status: string): string =>
    status === "Finalized"
      ? "bg-green-100 text-green-700"
      : "bg-slate-100 text-slate-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-500" />
          {meetingTypeLabel(meetingType)} — {t("Minutes of Meeting")}
        </h3>
        {canEdit && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            {t("Add Minutes")}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
          {t("No minutes recorded yet")}
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      {m.title?.trim() ||
                        `${meetingTypeLabel(m.meetingType)} · ${formatDate(
                          m.meetingDate
                        )}`}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(m.meetingDate)}
                      </span>
                      {m.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {m.location}
                        </span>
                      )}
                      {m.attendees && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {m.attendees}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={statusBadgeClass(m.status)}>
                      {t(m.status)}
                    </Badge>
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(m)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {m.agenda && (
                  <div>
                    <p className="font-medium text-slate-700">{t("Agenda")}</p>
                    <p className="text-slate-600 whitespace-pre-wrap">
                      {m.agenda}
                    </p>
                  </div>
                )}
                {m.minutes && (
                  <div>
                    <p className="font-medium text-slate-700">{t("Minutes")}</p>
                    <p className="text-slate-600 whitespace-pre-wrap">
                      {m.minutes}
                    </p>
                  </div>
                )}
                {m.decisions && (
                  <div>
                    <p className="font-medium text-slate-700">
                      {t("Decisions & Action Plans")}
                    </p>
                    <p className="text-slate-600 whitespace-pre-wrap">
                      {m.decisions}
                    </p>
                  </div>
                )}
                <Separator />
                <p className="text-xs text-slate-400">
                  {t("Recorded by")} {m.createdByName?.trim() || t("Unknown")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("Edit Minutes") : t("Add Minutes")} —{" "}
              {meetingTypeLabel(meetingType)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Title")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("Meeting title")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("Meeting Date")}</Label>
                <DatePicker
                  value={form.meetingDate || undefined}
                  onChange={(d) =>
                    setForm({
                      ...form,
                      meetingDate: d ? formatLocalDate(d) : "",
                    })
                  }
                  placeholder={t("Select date")}
                />
              </div>
              <div>
                <Label>{t("Location")}</Label>
                <Input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>{t("Attendees")}</Label>
              <Textarea
                value={form.attendees}
                onChange={(e) =>
                  setForm({ ...form, attendees: e.target.value })
                }
                rows={2}
                placeholder={t("List of attendees")}
              />
            </div>
            <div>
              <Label>{t("Agenda")}</Label>
              <Textarea
                value={form.agenda}
                onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>{t("Minutes")}</Label>
              <Textarea
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                rows={5}
              />
            </div>
            <div>
              <Label>{t("Decisions & Action Plans")}</Label>
              <Textarea
                value={form.decisions}
                onChange={(e) =>
                  setForm({ ...form, decisions: e.target.value })
                }
                rows={3}
              />
            </div>
            <div>
              <Label>{t("Status")}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">{t("Draft")}</SelectItem>
                  <SelectItem value="Finalized">{t("Finalized")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditing(null);
              }}
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? t("Save") : t("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Minutes")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete these minutes?")}{" "}
              {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
