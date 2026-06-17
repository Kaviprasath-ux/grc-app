"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { FileText, Upload, Download, Trash2, Loader2, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ApmAttachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  uploadedByName: string | null;
  createdAt: string;
}

interface ProgramOverviewRow {
  auditTitle: string;
  department: string;
  period: string;
}

interface Apm {
  id: string;
  programOverview: string | null;
  status: string;
  attachments: ApmAttachment[];
}

interface AuditPlanningMemorandumProps {
  engagementId: string;
  canEdit: boolean;
}

const emptyProgram: ProgramOverviewRow = { auditTitle: "", department: "", period: "" };

export default function AuditPlanningMemorandum({
  engagementId,
  canEdit,
}: AuditPlanningMemorandumProps) {
  const { t } = useLanguage();

  const [apm, setApm] = useState<Apm | null>(null);
  const [attachments, setAttachments] = useState<ApmAttachment[]>([]);
  const [program, setProgram] = useState<ProgramOverviewRow>(emptyProgram);

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
      setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      try {
        const parsed = data.programOverview ? JSON.parse(data.programOverview) : null;
        // Accept either a single object or a legacy array (use first row).
        const row = Array.isArray(parsed) ? parsed[0] : parsed;
        setProgram({
          auditTitle: row?.auditTitle ?? "",
          department: row?.department ?? "",
          period: row?.period ?? "",
        });
      } catch {
        setProgram(emptyProgram);
      }
    } else {
      setAttachments([]);
      setProgram(emptyProgram);
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
      const res = await fetch(baseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programOverview: program }),
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

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Memorandum — A. Audit Program Overview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            {t("Audit Planning Memorandum")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!apm && !canEdit ? (
            <div className="border border-dashed rounded-lg p-8 text-center text-sm text-slate-500">
              {t("No memorandum yet")}
            </div>
          ) : canEdit ? (
            <>
              <div className="space-y-3">
                <Label className="font-semibold">{t("A. Audit Program Overview")}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>{t("Audit Title")}</Label>
                    <Input
                      value={program.auditTitle}
                      onChange={(e) => setProgram({ ...program, auditTitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("Department")}</Label>
                    <Input
                      value={program.department}
                      onChange={(e) => setProgram({ ...program, department: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{t("Period")}</Label>
                    <Input
                      value={program.period}
                      onChange={(e) => setProgram({ ...program, period: e.target.value })}
                    />
                  </div>
                </div>
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
            <div>
              <p className="font-medium text-slate-700 mb-2">{t("A. Audit Program Overview")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">{t("Audit Title")}</p>
                  <p className="text-slate-600">{program.auditTitle || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("Department")}</p>
                  <p className="text-slate-600">{program.department || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">{t("Period")}</p>
                  <p className="text-slate-600">{program.period || "—"}</p>
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
            <div className="flex items-center gap-2">
              <a
                href="/api/internal-audit/templates/audit-program"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  {t("Download Template")}
                </Button>
              </a>
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
