"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
  FileText,
  Upload,
  Download,
  Trash2,
  Loader2,
  Save,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocalDate } from "@/lib/utils";

interface ApmAttachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  uploadedByName: string | null;
  createdAt: string;
}

interface Apm {
  id: string;
  scope: string | null;
  objectives: string | null;
  methodology: string | null;
  timeline: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  attachments: ApmAttachment[];
}

interface AuditPlanningMemorandumProps {
  engagementId: string;
  canEdit: boolean;
}

interface ApmFormState {
  scope: string;
  objectives: string;
  methodology: string;
  timeline: string;
  startDate: string;
  endDate: string;
  status: string;
}

const emptyForm: ApmFormState = {
  scope: "",
  objectives: "",
  methodology: "",
  timeline: "",
  startDate: "",
  endDate: "",
  status: "Draft",
};

export default function AuditPlanningMemorandum({
  engagementId,
  canEdit,
}: AuditPlanningMemorandumProps) {
  const { t } = useLanguage();

  const [apm, setApm] = useState<Apm | null>(null);
  const [attachments, setAttachments] = useState<ApmAttachment[]>([]);
  const [form, setForm] = useState<ApmFormState>(emptyForm);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<ApmAttachment | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseUrl = `/api/internal-audit/engagements/${engagementId}/apm`;

  const formatDate = useCallback((iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  }, []);

  const formatSize = useCallback((bytes: number | null): string => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  const applyApm = useCallback((data: Apm | null) => {
    setApm(data);
    if (data) {
      setForm({
        scope: data.scope ?? "",
        objectives: data.objectives ?? "",
        methodology: data.methodology ?? "",
        timeline: data.timeline ?? "",
        startDate: data.startDate ? data.startDate.slice(0, 10) : "",
        endDate: data.endDate ? data.endDate.slice(0, 10) : "",
        status: data.status || "Draft",
      });
      setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
    } else {
      setForm(emptyForm);
      setAttachments([]);
    }
  }, []);

  const loadApm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(baseUrl);
      if (!res.ok) throw new Error("Failed");
      const data: Apm | null = await res.json();
      applyApm(data);
    } catch {
      toast.error(t("Failed to load audit planning memorandum"));
      applyApm(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, applyApm, t]);

  const loadAttachments = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/attachments`);
      if (!res.ok) throw new Error("Failed");
      const data: ApmAttachment[] = await res.json();
      setAttachments(Array.isArray(data) ? data : []);
    } catch {
      toast.error(t("Failed to load documents"));
    }
  }, [baseUrl, t]);

  useEffect(() => {
    void loadApm();
  }, [loadApm]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        scope: form.scope.trim() || null,
        objectives: form.objectives.trim() || null,
        methodology: form.methodology.trim() || null,
        timeline: form.timeline.trim() || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        status: form.status,
      };

      const res = await fetch(baseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");

      toast.success(t("Audit planning memorandum saved"));
      await loadApm();
    } catch {
      toast.error(t("Failed to save audit planning memorandum"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const res = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed");

      toast.success(t("Documents uploaded"));
      await loadAttachments();
    } catch {
      toast.error(t("Failed to upload documents"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseUrl}/attachments/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Document deleted"));
      setDeleteTarget(null);
      await loadAttachments();
    } catch {
      toast.error(t("Failed to delete document"));
    } finally {
      setDeleting(false);
    }
  };

  const statusBadgeClass = (status: string): string =>
    status === "Finalized"
      ? "bg-green-100 text-green-700"
      : "bg-slate-100 text-slate-600";

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Memorandum */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-500" />
              {t("Audit Planning Memorandum")}
            </CardTitle>
            {apm && (
              <Badge className={statusBadgeClass(form.status)}>
                {t(form.status)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!apm && !canEdit ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
              {t("No memorandum yet")}
            </div>
          ) : canEdit ? (
            <>
              <div>
                <Label>{t("Scope")}</Label>
                <Textarea
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                  rows={3}
                  placeholder={t("Audit scope")}
                />
              </div>
              <div>
                <Label>{t("Objectives")}</Label>
                <Textarea
                  value={form.objectives}
                  onChange={(e) =>
                    setForm({ ...form, objectives: e.target.value })
                  }
                  rows={3}
                  placeholder={t("Audit objectives")}
                />
              </div>
              <div>
                <Label>{t("Methodology")}</Label>
                <Textarea
                  value={form.methodology}
                  onChange={(e) =>
                    setForm({ ...form, methodology: e.target.value })
                  }
                  rows={3}
                  placeholder={t("Audit methodology")}
                />
              </div>
              <div>
                <Label>{t("Timeline")}</Label>
                <Textarea
                  value={form.timeline}
                  onChange={(e) =>
                    setForm({ ...form, timeline: e.target.value })
                  }
                  rows={3}
                  placeholder={t("Audit timeline")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("Start Date")}</Label>
                  <DatePicker
                    value={form.startDate || undefined}
                    onChange={(d) =>
                      setForm({
                        ...form,
                        startDate: d ? formatLocalDate(d) : "",
                      })
                    }
                    placeholder={t("Select date")}
                  />
                </div>
                <div>
                  <Label>{t("End Date")}</Label>
                  <DatePicker
                    value={form.endDate || undefined}
                    onChange={(d) =>
                      setForm({
                        ...form,
                        endDate: d ? formatLocalDate(d) : "",
                      })
                    }
                    placeholder={t("Select date")}
                  />
                </div>
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
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {t("Save")}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Separator />
              <div>
                <p className="font-medium text-slate-700">{t("Scope")}</p>
                <p className="text-slate-600 whitespace-pre-wrap">
                  {form.scope.trim() || "—"}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700">{t("Objectives")}</p>
                <p className="text-slate-600 whitespace-pre-wrap">
                  {form.objectives.trim() || "—"}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700">{t("Methodology")}</p>
                <p className="text-slate-600 whitespace-pre-wrap">
                  {form.methodology.trim() || "—"}
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700">{t("Timeline")}</p>
                <p className="text-slate-600 whitespace-pre-wrap">
                  {form.timeline.trim() || "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-slate-700">{t("Start Date")}</p>
                  <p className="text-slate-600">{formatDate(apm?.startDate ?? null)}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-700">{t("End Date")}</p>
                  <p className="text-slate-600">{formatDate(apm?.endDate ?? null)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-500" />
              {t("Audit Program Documents")}
            </CardTitle>
            {canEdit && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  {t("Upload")}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
              {t("No documents uploaded yet")}
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate">
                        {att.fileName}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                        {att.fileSize !== null && (
                          <span>{formatSize(att.fileSize)}</span>
                        )}
                        <span>
                          {t("Uploaded by")}{" "}
                          {att.uploadedByName?.trim() || t("Unknown")}
                        </span>
                        <span>{formatDate(att.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`${baseUrl}/attachments/${att.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(att)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete Document")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this document?")}{" "}
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
