"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Home, ChevronRight, Pencil, AlertTriangle, Sparkles, Loader2, Check, X, Languages, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataGrid } from "@/components/shared";
import { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { TRANSLATABLE_MODELS } from "@/lib/translation-config";

interface TranslationRecord {
  id: string;
  modelName: string;
  recordId: string;
  fieldName: string;
  locale: string;
  originalText: string | null;
  translatedText: string | null;
  translatedBy: string | null;
  isStale: boolean;
  updatedAt: string | null;
  isNew?: boolean; // true if no DynamicTranslation record exists yet
}

// Get unique model names for the filter dropdown
const modelNames = [...new Set(TRANSLATABLE_MODELS.map((m) => m.modelName))].sort();

export default function TranslationManagementPage() {
  const { t } = useLanguage();
  const { toast } = useToast();

  // Filters
  const [modelFilter, setModelFilter] = useState<string>("__none__");
  const [localeFilter, setLocaleFilter] = useState<string>("__none__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  // Data
  const [translations, setTranslations] = useState<TranslationRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<TranslationRecord | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiTranslating, setAiTranslating] = useState(false);

  // Translate All state
  const [translateAllRunning, setTranslateAllRunning] = useState(false);
  const [translateAllProgress, setTranslateAllProgress] = useState({ done: 0, total: 0 });
  const cancelRef = useRef(false);

  // Whether we have valid filters to fetch data
  const filtersReady = modelFilter !== "__none__" && localeFilter !== "__none__";

  // Count of untranslated rows
  const untranslatedCount = translations.filter(r => r.isNew && r.originalText).length;

  // Fetch translations
  const fetchTranslations = useCallback(async () => {
    if (!filtersReady) {
      setTranslations([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("source", "true");
      params.set("modelName", modelFilter);
      params.set("locale", localeFilter);
      if (statusFilter !== "__all__") params.set("status", statusFilter);

      const res = await fetch(`/api/translations/manage?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTranslations(data);
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to load translations"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("Error"),
        description: t("Failed to load translations"),
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [modelFilter, localeFilter, statusFilter, filtersReady, t, toast]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  // Open edit dialog
  const handleEdit = (row: TranslationRecord) => {
    setEditRecord(row);
    setEditText(row.translatedText || "");
    setEditDialogOpen(true);
  };

  // Save — upsert via POST for new, PATCH for existing
  const handleSave = async () => {
    if (!editRecord || !editText.trim()) return;
    setSaving(true);
    try {
      let res: Response;
      if (editRecord.isNew) {
        // Create/upsert via POST
        res = await fetch("/api/translations/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelName: editRecord.modelName,
            recordId: editRecord.recordId,
            fieldName: editRecord.fieldName,
            locale: editRecord.locale,
            translatedText: editText,
          }),
        });
      } else {
        // Update existing via PATCH
        res = await fetch(`/api/translations/manage/${editRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ translatedText: editText }),
        });
      }
      if (res.ok) {
        toast({
          title: t("Success"),
          description: t("Translation updated successfully"),
        });
        setEditDialogOpen(false);
        setEditRecord(null);
        fetchTranslations();
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to update translation"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("Error"),
        description: t("Failed to update translation"),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  // AI translate the original text
  const handleAiTranslate = async () => {
    if (!editRecord?.originalText || !editRecord.locale) return;
    setAiTranslating(true);
    try {
      const res = await fetch("/api/translations/manage/ai-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editRecord.originalText,
          targetLocale: editRecord.locale,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditText(data.translatedText);
        toast({
          title: t("Success"),
          description: t("AI translation generated"),
        });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: t("Error"),
          description: err.error || t("AI translation failed"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("Error"),
        description: t("AI translation failed"),
        variant: "destructive",
      });
    }
    setAiTranslating(false);
  };

  // Translate All — process untranslated rows in batches
  const handleTranslateAll = async () => {
    const pending = translations.filter(r => r.isNew && r.originalText);
    if (pending.length === 0) return;

    cancelRef.current = false;
    setTranslateAllRunning(true);
    setTranslateAllProgress({ done: 0, total: pending.length });

    let succeeded = 0;
    let failed = 0;
    const BATCH_SIZE = 3;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      if (cancelRef.current) break;

      const batch = pending.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (row) => {
          // Step 1: AI translate
          const aiRes = await fetch("/api/translations/manage/ai-translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: row.originalText,
              targetLocale: row.locale,
            }),
          });
          if (!aiRes.ok) throw new Error("AI translate failed");
          const { translatedText } = await aiRes.json();

          // Step 2: Save via upsert
          const saveRes = await fetch("/api/translations/manage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelName: row.modelName,
              recordId: row.recordId,
              fieldName: row.fieldName,
              locale: row.locale,
              translatedText,
            }),
          });
          if (!saveRes.ok) throw new Error("Save failed");
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") succeeded++;
        else failed++;
      }
      setTranslateAllProgress({ done: succeeded + failed, total: pending.length });
    }

    setTranslateAllRunning(false);

    if (cancelRef.current) {
      toast({ title: t("Info"), description: `${t("Translation cancelled")}. ${succeeded} ${t("completed")}, ${failed} ${t("failed")}.` });
    } else if (failed > 0) {
      toast({ title: t("Warning"), description: `${succeeded} ${t("completed")}, ${failed} ${t("failed")}.`, variant: "destructive" });
    } else {
      toast({ title: t("Success"), description: `${succeeded} ${t("translations completed")}` });
    }

    fetchTranslations();
  };

  const handleCancelTranslateAll = () => {
    cancelRef.current = true;
  };

  // Table columns
  const columns: ColumnDef<TranslationRecord>[] = [
    {
      accessorKey: "fieldName",
      header: t("Field"),
      cell: ({ row }) => (
        <span className="text-xs font-medium text-slate-600">{row.getValue("fieldName")}</span>
      ),
    },
    {
      accessorKey: "originalText",
      header: t("Original Text"),
      cell: ({ row }) => {
        const val = row.getValue("originalText") as string | null;
        return val ? (
          <span className="text-sm text-slate-600 line-clamp-2 max-w-[300px] block">
            {val}
          </span>
        ) : (
          <span className="text-xs text-slate-400">&mdash;</span>
        );
      },
    },
    {
      accessorKey: "translatedText",
      header: t("Translated Text"),
      cell: ({ row }) => {
        const val = row.getValue("translatedText") as string | null;
        return val ? (
          <span className="text-sm text-slate-800 line-clamp-2 max-w-[300px] block"
            dir={localeFilter === "ar" ? "rtl" : "ltr"}
          >
            {val}
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">{t("Not Translated")}</span>
        );
      },
    },
    {
      id: "status",
      header: t("Status"),
      cell: ({ row }) => {
        const isTranslated = !!row.original.translatedText;
        const isStale = row.original.isStale;
        if (isTranslated && isStale) {
          return (
            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-300 bg-amber-50">
              <AlertTriangle className="h-3 w-3" />
              {t("Stale")}
            </Badge>
          );
        }
        if (isTranslated) {
          return (
            <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-300 bg-emerald-50">
              <Check className="h-3 w-3" />
              {t("Translated")}
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-xs gap-1 text-slate-500 border-slate-300 bg-slate-50">
            <X className="h-3 w-3" />
            {t("Not Translated")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "translatedBy",
      header: t("Translated By"),
      cell: ({ row }) => {
        const by = row.getValue("translatedBy") as string | null;
        if (!by) return <span className="text-xs text-slate-400">&mdash;</span>;
        return (
          <Badge
            variant={by === "manual" ? "default" : "secondary"}
            className="text-xs"
          >
            {t(by)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "recordId",
      header: t("Record ID"),
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 font-mono truncate max-w-[100px] block">
          {row.getValue("recordId")}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Actions"),
      size: 80,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
          onClick={() => handleEdit(row.original)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Organization")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link
          href="/organization/settings"
          className="text-slate-500 hover:text-primary-600 transition-colors"
        >
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">
          {t("Translation Management")}
        </span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          {t("Translation Management")}
        </h1>
        <p className="text-sm text-slate-500">
          {t("View and edit AI-generated translations")}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t("Select a model")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" disabled>{t("Select a model")}</SelectItem>
            {modelNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={localeFilter} onValueChange={setLocaleFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder={t("Select a locale")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__" disabled>{t("Select a locale")}</SelectItem>
            <SelectItem value="ar">Arabic (ar)</SelectItem>
            <SelectItem value="lv">Latvian (lv)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t("Translation Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("All")}</SelectItem>
            <SelectItem value="translated">{t("Translated")}</SelectItem>
            <SelectItem value="not_translated">{t("Not Translated")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Translate All button */}
        {filtersReady && !loading && untranslatedCount > 0 && (
          <div className="flex items-center gap-2 sm:ltr:ml-auto sm:rtl:mr-auto">
            {translateAllRunning ? (
              <>
                <div className="flex items-center gap-2 text-sm text-primary-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {t("Translating")} {translateAllProgress.done}/{translateAllProgress.total}...
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleCancelTranslateAll}
                >
                  <Square className="h-3 w-3" />
                  {t("Stop")}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm text-primary-600 border-primary-200 hover:bg-primary-50"
                onClick={handleTranslateAll}
              >
                <Languages className="h-4 w-4" />
                {t("Translate All")} ({untranslatedCount})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Data Grid or Prompt */}
      {!filtersReady ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <p className="text-base font-medium">{t("Select a model and locale to view records")}</p>
          <p className="text-sm">{t("Choose a model and language from the filters above")}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("Loading...")}
        </div>
      ) : (
        <DataGrid
          columns={columns}
          data={translations}
          searchPlaceholder={t("Search translations...")}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setEditDialogOpen(false); setEditRecord(null); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {editRecord?.isNew ? t("Add Translation") : t("Edit Translation")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          {editRecord && (
            <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4">
              {/* Read-only metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">{t("Model")}</Label>
                  <p className="text-sm font-medium text-slate-700">{editRecord.modelName}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">{t("Field")}</Label>
                  <p className="text-sm font-medium text-slate-700">{editRecord.fieldName}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">{t("Record ID")}</Label>
                  <p className="text-sm font-mono text-slate-700 truncate">{editRecord.recordId}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">{t("Locale")}</Label>
                  <p className="text-sm font-medium text-slate-700">{editRecord.locale}</p>
                </div>
              </div>

              {/* Original text */}
              {editRecord.originalText && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Original Text")}
                  </Label>
                  <div className="mt-1.5 p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600 whitespace-pre-wrap">
                    {editRecord.originalText}
                  </div>
                </div>
              )}

              {/* Editable translated text */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Translated Text")} <span className="text-error">*</span>
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-primary-600 border-primary-200 hover:bg-primary-50"
                    onClick={handleAiTranslate}
                    disabled={aiTranslating || !editRecord.originalText}
                    title={!editRecord.originalText ? t("No original text available") : t("AI Translate")}
                  >
                    {aiTranslating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {aiTranslating ? t("Translating...") : t("AI Translate")}
                  </Button>
                </div>
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="mt-1.5 bg-white"
                  dir={editRecord.locale === "ar" ? "rtl" : "ltr"}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg justify-end [direction:ltr]">
            <Button
              variant="outline"
              onClick={() => { setEditDialogOpen(false); setEditRecord(null); }}
            >
              {t("Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || !editText.trim()}>
              {saving ? t("Loading...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
