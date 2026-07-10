"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Save,
  RefreshCw,
  Info,
  Download,
  FileCheck,
  Upload,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import type {
  CharterBlock,
  CharterInlineNode,
  CharterRow,
} from "@/lib/charter-parser";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CharterData {
  id: string;
  originalFileName: string | null;
  content: CharterBlock[];
  fieldValues: Record<string, string>;
  uploadedAt: string;
  signedCopyFileName: string | null;
  signedCopyMimeType: string | null;
  signedCopyUploadedAt: string | null;
}

// ── Editable field ─────────────────────────────────────────────────────────────

function FieldInput({
  fieldId,
  defaultValue,
  values,
  onChange,
  readOnly,
}: {
  fieldId: string;
  defaultValue: string;
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
  readOnly: boolean;
}) {
  const value = values[fieldId] ?? defaultValue;
  const isMultiline = defaultValue.length > 60;

  if (readOnly) {
    return (
      <span className="text-blue-600 dark:text-blue-400 font-medium">{value}</span>
    );
  }

  if (isMultiline) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(fieldId, e.target.value)}
        rows={2}
        className="inline-block align-top min-w-[260px] max-w-[480px] h-auto text-blue-700 dark:text-blue-400 border-0 border-b-2 border-blue-400 focus:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 bg-blue-50/40 dark:bg-blue-950/20 rounded-none px-1 py-0.5 text-sm resize-none"
      />
    );
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(fieldId, e.target.value)}
      className="inline-block border-0 border-b-2 border-blue-400 focus:border-blue-600 focus-visible:ring-0 focus-visible:ring-offset-0 bg-blue-50/40 dark:bg-blue-950/20 rounded-none px-1 py-0 h-6 text-blue-700 dark:text-blue-400 text-sm align-baseline"
      style={{ width: `${Math.max(80, Math.min(360, (value.length + 4) * 7.2))}px` }}
    />
  );
}

// ── Inline segment renderer ────────────────────────────────────────────────────

function RenderSegments({
  segments,
  values,
  onChange,
  readOnly,
}: {
  segments: CharterInlineNode[];
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
  readOnly: boolean;
}) {
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <React.Fragment key={i}>{seg.content}</React.Fragment>
        ) : (
          <FieldInput
            key={`${seg.id}-${i}`}
            fieldId={seg.id}
            defaultValue={seg.defaultValue}
            values={values}
            onChange={onChange}
            readOnly={readOnly}
          />
        )
      )}
    </>
  );
}

// ── Block renderer ─────────────────────────────────────────────────────────────

function RenderBlock({
  block,
  values,
  onChange,
  readOnly,
}: {
  block: CharterBlock;
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
  readOnly: boolean;
}) {
  const segProps = { values, onChange, readOnly };

  switch (block.type) {
    case "heading": {
      const cls: Record<number, string> = {
        1: "text-2xl font-bold mt-8 mb-3 text-foreground",
        2: "text-lg font-semibold mt-6 mb-2 text-foreground",
        3: "text-base font-semibold mt-5 mb-2 text-foreground",
        4: "text-sm font-semibold mt-4 mb-1 text-foreground",
        5: "text-sm font-semibold mt-3 mb-1 text-muted-foreground",
        6: "text-xs font-medium mt-2 mb-1 text-muted-foreground uppercase tracking-wide",
      };
      const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag className={cls[block.level] ?? cls[4]}>
          <RenderSegments segments={block.segments} {...segProps} />
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p className="text-sm leading-7 mb-3 text-foreground">
          <RenderSegments segments={block.segments} {...segProps} />
        </p>
      );

    case "table":
      return (
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {block.rows.map((row: CharterRow, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.cells.map((cell, ci) => {
                    const CellTag = cell.isHeader ? "th" : "td";
                    return (
                      <CellTag
                        key={ci}
                        className={`border border-border p-2 align-top text-sm ${
                          cell.isHeader ? "bg-muted font-semibold text-left" : ""
                        }`}
                      >
                        <RenderSegments segments={cell.segments} {...segProps} />
                      </CellTag>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={`text-sm mb-3 pl-6 space-y-1.5 ${
            block.ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {block.items.map((item, i) => (
            <li key={i} className="text-foreground leading-relaxed">
              <RenderSegments segments={item.segments} {...segProps} />
            </li>
          ))}
        </ListTag>
      );
    }

    default:
      return null;
  }
}

// ── Collect unique editable fields from content ────────────────────────────────

function collectFields(
  blocks: CharterBlock[]
): Array<{ id: string; defaultValue: string }> {
  const seen = new Set<string>();
  const fields: Array<{ id: string; defaultValue: string }> = [];

  function scanSegs(segs: CharterInlineNode[]) {
    for (const seg of segs) {
      if (seg.type === "field" && !seen.has(seg.id)) {
        seen.add(seg.id);
        fields.push({ id: seg.id, defaultValue: seg.defaultValue });
      }
    }
  }

  for (const block of blocks) {
    if (block.type === "heading" || block.type === "paragraph") scanSegs(block.segments);
    else if (block.type === "list") block.items.forEach((it) => scanSegs(it.segments));
    else if (block.type === "table")
      block.rows.forEach((r) => r.cells.forEach((c) => scanSegs(c.segments)));
  }

  return fields;
}

function labelFromDefault(defaultValue: string): string {
  return defaultValue
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Editable fields panel ──────────────────────────────────────────────────────

function EditableFieldsPanel({
  blocks,
  values,
  onChange,
  t,
}: {
  blocks: CharterBlock[];
  values: Record<string, string>;
  onChange: (id: string, val: string) => void;
  t: (s: string) => string;
}) {
  const fields = collectFields(blocks);
  if (fields.length === 0) return null;

  return (
    <div className="mb-5 border border-blue-200 dark:border-blue-800 rounded-xl bg-blue-50/40 dark:bg-blue-950/10 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {t("Editable Fields")}
        </span>
        <span className="text-xs text-blue-500 dark:text-blue-400 ml-1">
          {t("— changes apply throughout the document")}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
        {fields.map(({ id, defaultValue }) => {
          const value = values[id] ?? defaultValue;
          const isMultiline = defaultValue.length > 60;
          return (
            <div key={id} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-blue-700 dark:text-blue-300">
                {t(labelFromDefault(defaultValue))}
              </label>
              {isMultiline ? (
                <Textarea
                  value={value}
                  onChange={(e) => onChange(id, e.target.value)}
                  rows={2}
                  className="text-sm resize-none border-blue-300 dark:border-blue-700 focus-visible:ring-blue-400 bg-white dark:bg-background"
                />
              ) : (
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(id, e.target.value)}
                  className="text-sm h-8 border-blue-300 dark:border-blue-700 focus-visible:ring-blue-400 bg-white dark:bg-background"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Signed copy section — just a view button ──────────────────────────────────

function SignedCopySection({
  charter,
  t,
}: {
  charter: CharterData | null;
  t: (s: string) => string;
}) {
  if (!charter?.signedCopyFileName) return null;

  return (
    <div className="mt-6 border border-border rounded-xl bg-card shadow-sm">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        <FileCheck className="h-5 w-5 text-green-600" />
        <h2 className="font-semibold text-base">{t("Uploaded Signed Documents")}</h2>
      </div>
      <div className="px-6 py-4 flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <a
            href="/api/internal-audit/audit-charter/signed-copy"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-1.5" />
            {t("View Signed Copy")}
          </a>
        </Button>
        <span className="text-xs text-muted-foreground">{charter.signedCopyFileName}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuditCharterPage() {
  const { t, locale } = useLanguage();
  const { canEdit } = usePermissions("audit.charter");

  const [charter, setCharter] = useState<CharterData | null>(null);
  const [translatedBlocks, setTranslatedBlocks] = useState<CharterBlock[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const signedFileRef = useRef<HTMLInputElement>(null);

  // ── Load charter ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/internal-audit/audit-charter")
      .then((r) => r.json())
      .then((data: CharterData | null) => {
        if (data) {
          setCharter(data);
          setValues(data.fieldValues ?? {});
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch translated blocks when locale changes ────────────────────────────
  useEffect(() => {
    if (!charter || locale === "en") {
      setTranslatedBlocks(null);
      return;
    }
    setTranslating(true);
    fetch("/api/internal-audit/audit-charter/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    })
      .then(async (r) => {
        const res = await r.json() as { content?: CharterBlock[]; error?: string };
        if (res.content) {
          setTranslatedBlocks(res.content);
        } else {
          console.error("Charter translation returned no content:", res);
        }
      })
      .catch((err) => console.error("Charter translation fetch failed:", err))
      .finally(() => setTranslating(false));
  }, [charter, locale]);

  // ── Field change ───────────────────────────────────────────────────────────
  const handleFieldChange = useCallback((id: string, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
    setDirty(true);
  }, []);

  // ── Save field values ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/internal-audit/audit-charter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldValues: values }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data: CharterData = await res.json();
      setCharter((prev) => (prev ? { ...prev, fieldValues: data.fieldValues } : prev));
      setDirty(false);
      toast.success(t("Charter saved"));
    } catch {
      toast.error(t("Failed to save charter"));
    } finally {
      setSaving(false);
    }
  }, [values, t]);

  // ── Download Word ──────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/internal-audit/audit-charter/download");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-charter.docx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("Failed to download document"));
    } finally {
      setDownloading(false);
    }
  }, [t]);

  // ── Upload signed copy ─────────────────────────────────────────────────────
  const handleSignedUpload = useCallback(
    async (file: File) => {
      setUploadingSigned(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/internal-audit/audit-charter/signed-copy", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || "Upload failed");
        }
        const data: CharterData = await res.json();
        setCharter(data);
        toast.success(t("Signed copy uploaded"));
      } catch (err) {
        toast.error((err as Error).message || t("Failed to upload signed copy"));
      } finally {
        setUploadingSigned(false);
      }
    },
    [t]
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
        {t("Loading…")}
      </div>
    );
  }

  const readOnly = !canEdit;
  const blocks = (translatedBlocks ?? charter?.content ?? []) as CharterBlock[];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">{t("Audit Charter")}</h1>
            {translating && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {t("Translating…")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Word */}
          <Button variant="outline" size="sm" disabled={downloading} onClick={handleDownload}>
            {downloading ? (
              <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            {downloading ? t("Generating…") : t("Download Word")}
          </Button>

          {/* Upload Signed Copy — editors only */}
          {canEdit && (
            <>
              <input
                ref={signedFileRef}
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                disabled={uploadingSigned}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSignedUpload(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploadingSigned}
                onClick={() => signedFileRef.current?.click()}
              >
                {uploadingSigned ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1.5" />
                )}
                {uploadingSigned ? t("Uploading…") : t("Upload Signed Copy")}
              </Button>
            </>
          )}

          {/* Save Changes */}
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {saving ? t("Saving…") : t("Save Changes")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Editable fields panel ─────────────────────────────────────────── */}
      {canEdit && blocks.length > 0 && (
        <EditableFieldsPanel
          blocks={blocks}
          values={values}
          onChange={handleFieldChange}
          t={t}
        />
      )}

      {/* ── Document body ─────────────────────────────────────────────────── */}
      {charter ? (
        <div className="border border-border rounded-xl bg-card shadow-sm">
          <div className="p-8 lg:p-10">
            {blocks.map((block, i) => (
              <RenderBlock
                key={i}
                block={block}
                values={values}
                onChange={handleFieldChange}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Sticky save bar */}
          {canEdit && dirty && (
            <div className="border-t border-border px-8 py-3 flex items-center justify-between bg-muted/40 rounded-b-xl">
              <span className="text-sm text-muted-foreground">
                {t("You have unsaved changes")}
              </span>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                {saving ? t("Saving…") : t("Save Changes")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground text-sm p-8 border rounded-xl text-center">
          {t("Unable to load charter. Please refresh the page.")}
        </div>
      )}

      {/* ── Uploaded signed documents section ─────────────────────────────── */}
      <SignedCopySection charter={charter} t={t} />
    </div>
  );
}
