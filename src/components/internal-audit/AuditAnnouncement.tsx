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
import { Mail, Send, Save, Loader2, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocalDate } from "@/lib/utils";

interface Recipient {
  name: string;
  email: string;
}

interface Announcement {
  id: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  additionalRecipients: Recipient[] | string | null;
  subject: string | null;
  body: string | null;
  commenceDate: string | null;
  status: string;
  sentAt: string | null;
  sentByName: string | null;
}

interface AuditAnnouncementProps {
  engagementId: string;
  canEdit: boolean;
}

interface AnnouncementFormState {
  recipientName: string;
  recipientEmail: string;
  additionalRecipients: Recipient[];
  subject: string;
  body: string;
  commenceDate: string;
}

const emptyForm: AnnouncementFormState = {
  recipientName: "",
  recipientEmail: "",
  additionalRecipients: [],
  subject: "",
  body: "",
  commenceDate: "",
};

// Tolerantly parse additionalRecipients which may arrive as an array or a JSON string.
function parseRecipients(value: Recipient[] | string | null | undefined): Recipient[] {
  if (Array.isArray(value)) return value.filter((r) => r && typeof r.email === "string");
  if (typeof value === "string" && value.trim()) {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? arr.filter((r) => r && typeof r.email === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function AuditAnnouncement({
  engagementId,
  canEdit,
}: AuditAnnouncementProps) {
  const { t } = useLanguage();

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementFormState>(emptyForm);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [confirmSend, setConfirmSend] = useState<boolean>(false);

  const baseUrl = `/api/internal-audit/engagements/${engagementId}/announcement`;

  const formatDateTime = useCallback((iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }, []);

  const applyAnnouncement = useCallback((data: Announcement | null) => {
    setAnnouncement(data);
    setForm({
      recipientName: data?.recipientName ?? "",
      recipientEmail: data?.recipientEmail ?? "",
      additionalRecipients: parseRecipients(data?.additionalRecipients),
      subject: data?.subject ?? "",
      body: data?.body ?? "",
      commenceDate: data?.commenceDate ? data.commenceDate.slice(0, 10) : "",
    });
  }, []);

  const loadAnnouncement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(baseUrl);
      if (!res.ok) throw new Error("Failed");
      const data: Announcement = await res.json();
      applyAnnouncement(data);
    } catch {
      toast.error(t("Failed to load announcement"));
      applyAnnouncement(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, applyAnnouncement, t]);

  useEffect(() => {
    void loadAnnouncement();
  }, [loadAnnouncement]);

  const buildPayload = () => ({
    recipientName: form.recipientName.trim() || null,
    recipientEmail: form.recipientEmail.trim() || null,
    additionalRecipients: form.additionalRecipients
      .map((r) => ({ name: r.name.trim(), email: r.email.trim() }))
      .filter((r) => r.email),
    subject: form.subject.trim() || null,
    body: form.body.trim() || null,
    commenceDate: form.commenceDate || null,
  });

  const addRecipient = () =>
    setForm((p) => ({ ...p, additionalRecipients: [...p.additionalRecipients, { name: "", email: "" }] }));
  const updateRecipient = (idx: number, field: keyof Recipient, value: string) =>
    setForm((p) => {
      const next = [...p.additionalRecipients];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, additionalRecipients: next };
    });
  const removeRecipient = (idx: number) =>
    setForm((p) => ({ ...p, additionalRecipients: p.additionalRecipients.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(baseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Announcement saved"));
      await loadAnnouncement();
    } catch {
      toast.error(t("Failed to save announcement"));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`${baseUrl}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Announcement sent"));
      setConfirmSend(false);
      await loadAnnouncement();
    } catch {
      toast.error(t("Failed to send announcement"));
    } finally {
      setSending(false);
    }
  };

  const isSent = announcement?.status === "Sent";
  const editable = canEdit && !isSent;

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-5 w-5 text-slate-500" />
              {t("Audit Announcement")}
            </CardTitle>
            {isSent ? (
              <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("Sent")}
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-600">{t("Draft")}</Badge>
            )}
          </div>
          {isSent && (
            <p className="text-xs text-slate-500 mt-1">
              {t("Sent by")} {announcement?.sentByName?.trim() || t("Unknown")}{" "}
              {t("on")} {formatDateTime(announcement?.sentAt ?? null)}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {editable ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("Recipient Name")}</Label>
                  <Input
                    value={form.recipientName}
                    onChange={(e) =>
                      setForm({ ...form, recipientName: e.target.value })
                    }
                    placeholder={t("Management contact")}
                  />
                </div>
                <div>
                  <Label>{t("Recipient Email")}</Label>
                  <Input
                    type="email"
                    value={form.recipientEmail}
                    onChange={(e) =>
                      setForm({ ...form, recipientEmail: e.target.value })
                    }
                    placeholder={t("Email address")}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>{t("Additional Recipients")}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
                    <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Add Recipient")}
                  </Button>
                </div>
                {form.additionalRecipients.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    {t("Add more people to receive this announcement (CC).")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.additionalRecipients.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                        <Input
                          value={r.name}
                          onChange={(e) => updateRecipient(idx, "name", e.target.value)}
                          placeholder={t("Recipient Name")}
                        />
                        <Input
                          type="email"
                          value={r.email}
                          onChange={(e) => updateRecipient(idx, "email", e.target.value)}
                          placeholder={t("Email address")}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-500"
                          onClick={() => removeRecipient(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>{t("Commence Date")}</Label>
                <DatePicker
                  value={form.commenceDate || undefined}
                  onChange={(d) =>
                    setForm({
                      ...form,
                      commenceDate: d ? formatLocalDate(d) : "",
                    })
                  }
                  placeholder={t("Select date")}
                />
              </div>
              <div>
                <Label>{t("Subject")}</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder={t("Announcement subject")}
                />
              </div>
              <div>
                <Label>{t("Message")}</Label>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={12}
                  placeholder={t("Announcement message")}
                />
              </div>
              <p className="text-xs text-slate-400">
                {t(
                  "The Preliminary Information Request (PBC) list is managed in the Fieldwork step and shared with the auditee."
                )}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {t("Save Draft")}
                </Button>
                <Button onClick={() => setConfirmSend(true)} disabled={sending}>
                  <Send className="h-4 w-4 mr-2" />
                  {t("Send Announcement")}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-slate-700">
                    {t("Recipient Name")}
                  </p>
                  <p className="text-slate-600">
                    {form.recipientName.trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-slate-700">
                    {t("Recipient Email")}
                  </p>
                  <p className="text-slate-600">
                    {form.recipientEmail.trim() || "—"}
                  </p>
                </div>
              </div>
              {form.additionalRecipients.length > 0 && (
                <div>
                  <p className="font-medium text-slate-700">{t("Additional Recipients")}</p>
                  <p className="text-slate-600">
                    {form.additionalRecipients
                      .map((r) => (r.name.trim() ? `${r.name.trim()} <${r.email.trim()}>` : r.email.trim()))
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
              )}
              <div>
                <p className="font-medium text-slate-700">{t("Subject")}</p>
                <p className="text-slate-600">{form.subject.trim() || "—"}</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">{t("Message")}</p>
                <p className="text-slate-600 whitespace-pre-wrap">
                  {form.body.trim() || "—"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Send Announcement")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Send this announcement to the auditee?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("Send")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
