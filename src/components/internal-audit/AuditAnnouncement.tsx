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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Mail, Send, Save, Loader2, CheckCircle2, Trash2, Plus } from "lucide-react";
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

interface IaUser {
  id: string;
  fullName: string;
  email: string;
}

interface AnnouncementFormState {
  recipients: Recipient[];
  subject: string;
  body: string;
  commenceDate: string;
}

const emptyForm: AnnouncementFormState = {
  recipients: [],
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

  const [iaUsers, setIaUsers] = useState<IaUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [confirmSend, setConfirmSend] = useState<boolean>(false);

  // External (non-IA-user) recipient entry
  const [showExternal, setShowExternal] = useState<boolean>(false);
  const [extName, setExtName] = useState<string>("");
  const [extEmail, setExtEmail] = useState<string>("");

  const baseUrl = `/api/internal-audit/engagements/${engagementId}/announcement`;

  // Load the customer's Internal Audit module users for the recipient picker.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/internal-audit/users");
        if (!res.ok) return;
        const data = await res.json();
        const list: IaUser[] = (Array.isArray(data) ? data : [])
          .map((u: { id: string; fullName?: string; userName?: string; email?: string }) => ({
            id: u.id,
            fullName: u.fullName || u.userName || u.email || "",
            email: u.email || "",
          }))
          .filter((u: IaUser) => u.email);
        setIaUsers(list);
      } catch {
        /* non-fatal: picker just stays empty */
      }
    })();
  }, []);

  const formatDateTime = useCallback((iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }, []);

  const applyAnnouncement = useCallback((data: Announcement | null) => {
    setAnnouncement(data);
    // Combine the primary recipient + additional recipients into one list, deduped by email.
    const combined: Recipient[] = [];
    const seen = new Set<string>();
    const push = (name: string, email: string) => {
      const e = (email || "").trim().toLowerCase();
      if (!e || seen.has(e)) return;
      seen.add(e);
      combined.push({ name: (name || "").trim(), email: email.trim() });
    };
    push(data?.recipientName ?? "", data?.recipientEmail ?? "");
    for (const r of parseRecipients(data?.additionalRecipients)) push(r.name, r.email);
    setForm({
      recipients: combined,
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

  const buildPayload = () => {
    const recips = form.recipients
      .map((r) => ({ name: (r.name || "").trim(), email: (r.email || "").trim() }))
      .filter((r) => r.email);
    return {
      // First selected recipient is the primary; the rest are additional.
      recipientName: recips[0]?.name || null,
      recipientEmail: recips[0]?.email || null,
      additionalRecipients: recips.slice(1),
      subject: form.subject.trim() || null,
      body: form.body.trim() || null,
      commenceDate: form.commenceDate || null,
    };
  };

  // Add a recipient picked from the IA-user dropdown (email auto-filled), deduped by email.
  const addRecipientFromUser = (userId: string) => {
    const u = iaUsers.find((x) => x.id === userId);
    if (!u) return;
    setForm((p) => {
      if (p.recipients.some((r) => r.email.toLowerCase() === u.email.toLowerCase())) return p;
      return { ...p, recipients: [...p.recipients, { name: u.fullName, email: u.email }] };
    });
  };
  const removeRecipientAt = (idx: number) =>
    setForm((p) => ({ ...p, recipients: p.recipients.filter((_, i) => i !== idx) }));

  // Add an external recipient (not an IA user) by name + email, deduped by email.
  const addExternalRecipient = () => {
    const email = extEmail.trim();
    const name = extName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t("Enter a valid email address"));
      return;
    }
    setForm((p) => {
      if (p.recipients.some((r) => r.email.toLowerCase() === email.toLowerCase())) return p;
      return { ...p, recipients: [...p.recipients, { name, email }] };
    });
    setExtName("");
    setExtEmail("");
    setShowExternal(false);
  };

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
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Label>{t("Recipients")}</Label>
                  {!showExternal && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowExternal(true)}>
                      <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                      {t("Add External Recipient")}
                    </Button>
                  )}
                </div>
                <Select value="" onValueChange={addRecipientFromUser}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Select recipient")} />
                  </SelectTrigger>
                  <SelectContent>
                    {iaUsers.filter(
                      (u) => !form.recipients.some((r) => r.email.toLowerCase() === u.email.toLowerCase())
                    ).length === 0 ? (
                      <div className="px-2 py-3 text-xs text-slate-400 text-center">
                        {iaUsers.length === 0 ? t("No users found") : t("All users already added")}
                      </div>
                    ) : (
                      iaUsers
                        .filter((u) => !form.recipients.some((r) => r.email.toLowerCase() === u.email.toLowerCase()))
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName} ({u.email})
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
                {showExternal && (
                  <div className="mt-2 flex flex-col sm:flex-row gap-2 sm:items-center rounded-md border border-slate-200 p-2">
                    <Input
                      value={extName}
                      onChange={(e) => setExtName(e.target.value)}
                      placeholder={t("Recipient Name")}
                      className="sm:flex-1"
                    />
                    <Input
                      type="email"
                      value={extEmail}
                      onChange={(e) => setExtEmail(e.target.value)}
                      placeholder={t("Email address")}
                      className="sm:flex-1"
                    />
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={addExternalRecipient}>
                        {t("Add")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowExternal(false);
                          setExtName("");
                          setExtEmail("");
                        }}
                      >
                        {t("Cancel")}
                      </Button>
                    </div>
                  </div>
                )}
                {form.recipients.length === 0 ? (
                  <p className="text-xs text-slate-400 mt-2">
                    {t("Select one or more recipients; their email is added automatically.")}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {form.recipients.map((r, idx) => (
                      <div
                        key={`${r.email}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {r.name || r.email}
                            {idx === 0 && (
                              <span className="ltr:ml-2 rtl:mr-2 text-[10px] uppercase tracking-wide text-primary-600">
                                {t("Primary")}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{r.email}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-500 shrink-0"
                          onClick={() => removeRecipientAt(idx)}
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
              <div>
                <p className="font-medium text-slate-700">{t("Recipients")}</p>
                <p className="text-slate-600">
                  {form.recipients
                    .map((r) => (r.name.trim() ? `${r.name.trim()} <${r.email.trim()}>` : r.email.trim()))
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
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
              {t("Send this announcement to the auditor?")}
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
