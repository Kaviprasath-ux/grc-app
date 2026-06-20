"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Trash2, Loader2, Save, Plus, Printer } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type ApmContent,
  type ApmFieldValue,
  type ApmFrameworkRow,
  APM_STRUCTURE,
  APM_RISK_RATINGS,
  APM_CONTROL_TYPES,
  APM_CONTROL_FREQUENCIES,
  cloneDefaultApmContent,
  normalizeApmContent,
  emptyFrameworkRow,
  makeCustomField,
  makeCustomSection,
  emptyAuditProgramRow,
  APM_AUDIT_PROGRAM_COLUMNS,
} from "@/lib/apm-template";

interface Apm {
  id: string;
  programOverview: string | null;
  content: string | null;
  status: string;
}

interface AuditPlanningMemorandumProps {
  engagementId: string;
  canEdit: boolean;
}

export default function AuditPlanningMemorandum({
  engagementId,
  canEdit,
}: AuditPlanningMemorandumProps) {
  const { t } = useLanguage();

  const [content, setContent] = useState<ApmContent>(cloneDefaultApmContent());

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Delete-fields dialog: which section, and which field ids are ticked.
  const [deleteFieldsSection, setDeleteFieldsSection] = useState<string | null>(null);
  const [fieldSelection, setFieldSelection] = useState<Record<string, boolean>>({});

  // Skip auto-save on the content set during load (only save real user edits).
  const autoSaveSkip = useRef(true);

  const baseUrl = `/api/internal-audit/engagements/${engagementId}/apm`;

  // Persist content silently (used by the debounced auto-save).
  const persistContent = useCallback(
    async (next: ApmContent) => {
      try {
        await fetch(baseUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next }),
        });
      } catch {
        /* best-effort; the explicit Save button surfaces errors */
      }
    },
    [baseUrl]
  );

  const applyApm = useCallback((data: Apm | null) => {
    // Content set here comes from the server, not a user edit — don't auto-save it.
    autoSaveSkip.current = true;
    if (data?.content) {
      try {
        setContent(normalizeApmContent(JSON.parse(data.content)));
      } catch {
        setContent(cloneDefaultApmContent());
      }
    } else {
      setContent(cloneDefaultApmContent());
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

  useEffect(() => {
    void loadApm();
  }, [loadApm]);

  // Auto-save content changes (add/delete/edit fields) so a page refresh keeps
  // them without requiring an explicit Save. Debounced; skips the initial load.
  useEffect(() => {
    if (!canEdit) return;
    if (autoSaveSkip.current) {
      autoSaveSkip.current = false;
      return;
    }
    const id = setTimeout(() => void persistContent(content), 700);
    return () => clearTimeout(id);
  }, [content, canEdit, persistContent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(baseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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

  // --- Content field helpers --------------------------------------------

  // Generate a unique id for a newly added custom field.
  const newFieldId = () => {
    try {
      return crypto.randomUUID();
    } catch {
      return `f-${performance.now().toString(36)}-${Math.floor(performance.now() % 1000)}`;
    }
  };

  // Update one field's value within a section (by field id).
  const setFieldValue = (sectionKey: string, id: string, value: string) =>
    setContent((c) => ({
      ...c,
      sections: {
        ...c.sections,
        [sectionKey]: (c.sections[sectionKey] ?? []).map((f) =>
          f.id === id ? { ...f, value } : f
        ),
      },
    }));

  // Update a custom field's label.
  const setFieldLabel = (sectionKey: string, id: string, label: string) =>
    setContent((c) => ({
      ...c,
      sections: {
        ...c.sections,
        [sectionKey]: (c.sections[sectionKey] ?? []).map((f) =>
          f.id === id ? { ...f, label } : f
        ),
      },
    }));

  // Add a new custom section (persisted immediately).
  const addSection = () => {
    const key = newFieldId();
    const next: ApmContent = {
      ...content,
      customSections: [...content.customSections, makeCustomSection(key)],
      sections: { ...content.sections, [key]: [] },
    };
    autoSaveSkip.current = true;
    setContent(next);
    void persistContent(next);
  };

  // Rename a custom section (debounced auto-save handles persistence).
  const setSectionTitle = (key: string, title: string) =>
    setContent((c) => ({
      ...c,
      customSections: c.customSections.map((s) =>
        s.key === key ? { ...s, title } : s
      ),
    }));

  // Delete a section (predefined or custom) and its fields, persisted now.
  // Predefined sections are recorded in `removedSections`; custom sections are
  // dropped from `customSections`.
  const deleteSection = (key: string) => {
    const isCustom = content.customSections.some((s) => s.key === key);
    const nextSections = { ...content.sections };
    delete nextSections[key];
    const next: ApmContent = {
      ...content,
      sections: nextSections,
      customSections: isCustom
        ? content.customSections.filter((s) => s.key !== key)
        : content.customSections,
      removedSections: isCustom
        ? content.removedSections
        : [...content.removedSections, key],
    };
    autoSaveSkip.current = true;
    setContent(next);
    void persistContent(next);
  };

  // Append a new custom field to a section (persisted immediately).
  const addField = (sectionKey: string) => {
    const next: ApmContent = {
      ...content,
      sections: {
        ...content.sections,
        [sectionKey]: [...(content.sections[sectionKey] ?? []), makeCustomField(newFieldId())],
      },
    };
    autoSaveSkip.current = true;
    setContent(next);
    void persistContent(next);
  };

  // --- Delete-fields dialog --------------------------------------------

  const openDeleteFields = (sectionKey: string) => {
    setDeleteFieldsSection(sectionKey);
    setFieldSelection({});
  };

  const dialogFields = deleteFieldsSection
    ? content.sections[deleteFieldsSection] ?? []
    : [];
  const allSelected =
    dialogFields.length > 0 && dialogFields.every((f) => fieldSelection[f.id]);
  const selectedCount = dialogFields.filter((f) => fieldSelection[f.id]).length;

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) dialogFields.forEach((f) => (next[f.id] = true));
    setFieldSelection(next);
  };

  // Display name for a field in the dialog (custom label, or translated label).
  const fieldDisplayName = (f: ApmFieldValue) =>
    f.custom ? f.label || t("Untitled field") : t(f.label);

  const confirmDeleteFields = () => {
    if (!deleteFieldsSection) return;
    const ids = dialogFields.filter((f) => fieldSelection[f.id]).map((f) => f.id);
    const next: ApmContent = {
      ...content,
      sections: {
        ...content.sections,
        [deleteFieldsSection]: (content.sections[deleteFieldsSection] ?? []).filter(
          (f) => !ids.includes(f.id)
        ),
      },
    };
    autoSaveSkip.current = true;
    setContent(next);
    void persistContent(next);
    setDeleteFieldsSection(null);
  };

  const toggleFactor = (index: number, checked: boolean) =>
    setContent((c) => ({
      ...c,
      triggerFactors: c.triggerFactors.map((f, i) =>
        i === index ? { ...f, checked } : f
      ),
    }));

  const setRow = (index: number, field: keyof ApmFrameworkRow, value: string) =>
    setContent((c) => ({
      ...c,
      frameworkRows: c.frameworkRows.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      ),
    }));

  const addRow = () =>
    setContent((c) => ({ ...c, frameworkRows: [...c.frameworkRows, emptyFrameworkRow()] }));

  const removeRow = (index: number) =>
    setContent((c) => ({
      ...c,
      frameworkRows: c.frameworkRows.filter((_, i) => i !== index),
    }));

  // --- Audit Program entries (inline working-paper input) ---------------

  const setProgramCell = (index: number, col: string, value: string) =>
    setContent((c) => ({
      ...c,
      auditProgramRows: c.auditProgramRows.map((row, i) =>
        i === index ? { ...row, [col]: value } : row
      ),
    }));

  const addProgramRow = () => {
    const next: ApmContent = {
      ...content,
      auditProgramRows: [...content.auditProgramRows, emptyAuditProgramRow()],
    };
    autoSaveSkip.current = true;
    setContent(next);
    void persistContent(next);
  };

  const removeProgramRow = (index: number) => {
    const next: ApmContent = {
      ...content,
      auditProgramRows: content.auditProgramRows.filter((_, i) => i !== index),
    };
    autoSaveSkip.current = true;
    setContent(next);
    void persistContent(next);
  };

  // Render one field instance: label + input (deletion is via the dialog).
  const renderField = (sectionKey: string, field: ApmFieldValue) => (
    <div key={field.id} className="space-y-1.5">
      {field.custom && canEdit ? (
        // Borderless, label-styled input so a typed custom label reads like
        // the predefined field labels rather than a boxed text input.
        <Input
          value={field.label}
          placeholder={t("Field label")}
          onChange={(e) => setFieldLabel(sectionKey, field.id, e.target.value)}
          className="h-auto max-w-xs border-0 bg-transparent px-0 py-0 text-xs font-medium text-slate-500 shadow-none focus-visible:ring-0 placeholder:text-slate-400/80"
        />
      ) : (
        <Label className="text-xs font-medium text-slate-500">{t(field.label)}</Label>
      )}
      {canEdit ? (
        field.type === "textarea" ? (
          <Textarea
            rows={3}
            value={field.value}
            onChange={(e) => setFieldValue(sectionKey, field.id, e.target.value)}
          />
        ) : (
          <Input
            type={field.type === "date" ? "date" : "text"}
            value={field.value}
            onChange={(e) => setFieldValue(sectionKey, field.id, e.target.value)}
          />
        )
      ) : (
        <p className="whitespace-pre-wrap text-slate-600">{field.value || "—"}</p>
      )}
    </div>
  );

  // Section 2 widget: trigger-factor checkboxes.
  const triggerFactorsWidget = (
    <div className="space-y-2 ltr:pl-1 rtl:pr-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {t("Trigger Factors")}
      </p>
      {content.triggerFactors.map((f, i) => (
        <label key={i} className="flex items-start gap-2 text-slate-600">
          <Checkbox
            className="mt-0.5"
            checked={f.checked}
            disabled={!canEdit}
            onCheckedChange={(v) => toggleFactor(i, v === true)}
          />
          <span>{t(f.label)}</span>
        </label>
      ))}
    </div>
  );

  // Section 7 widget: editable Risk & Control table.
  const frameworkTableWidget = (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-slate-500">
        {t("Risk & Control Matrix")}
      </Label>
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-2 font-medium">{t("Objective")}</th>
              <th className="p-2 font-medium">{t("Risk")}</th>
              <th className="p-2 font-medium">{t("Control")}</th>
              <th className="p-2 font-medium">{t("Audit Procedure")}</th>
              <th className="p-2 font-medium">{t("Risk Rating")}</th>
              <th className="p-2 font-medium">{t("Control Type")}</th>
              <th className="p-2 font-medium">{t("Control Frequency")}</th>
              {canEdit && <th className="p-2 w-8" />}
            </tr>
          </thead>
          <tbody>
            {content.frameworkRows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 align-top">
                {(["objective", "risk", "control", "auditProcedure"] as const).map((field) => (
                  <td key={field} className="p-1.5">
                    {canEdit ? (
                      <Textarea
                        rows={2}
                        className="min-h-[44px] text-xs"
                        value={row[field]}
                        onChange={(e) => setRow(i, field, e.target.value)}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap text-slate-600">{row[field] || "—"}</span>
                    )}
                  </td>
                ))}
                <td className="p-1.5">
                  {canEdit ? (
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={row.riskRating}
                      onChange={(e) => setRow(i, "riskRating", e.target.value)}
                    >
                      <option value="">—</option>
                      {APM_RISK_RATINGS.map((o) => (
                        <option key={o} value={o}>
                          {t(o)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-600">{row.riskRating || "—"}</span>
                  )}
                </td>
                <td className="p-1.5">
                  {canEdit ? (
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={row.controlType}
                      onChange={(e) => setRow(i, "controlType", e.target.value)}
                    >
                      <option value="">—</option>
                      {APM_CONTROL_TYPES.map((o) => (
                        <option key={o} value={o}>
                          {t(o)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-600">{row.controlType || "—"}</span>
                  )}
                </td>
                <td className="p-1.5">
                  {canEdit ? (
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={row.controlFrequency}
                      onChange={(e) => setRow(i, "controlFrequency", e.target.value)}
                    >
                      <option value="">—</option>
                      {APM_CONTROL_FREQUENCIES.map((o) => (
                        <option key={o} value={o}>
                          {t(o)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-600">{row.controlFrequency || "—"}</span>
                  )}
                </td>
                {canEdit && (
                  <td className="p-1.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={content.frameworkRows.length <= 1}
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          {t("Add Row")}
        </Button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
      </div>
    );
  }

  // Remaining predefined sections (deleted ones filtered out) followed by
  // user-added custom sections. Renumbered sequentially so there are no gaps.
  const orderedSections: Array<{
    key: string;
    number: number;
    title: string;
    special?: "triggerFactors" | "frameworkTable";
    specialAfter?: number;
    custom: boolean;
  }> = [
    ...APM_STRUCTURE.filter((s) => !content.removedSections.includes(s.key)).map((s) => ({
      key: s.key,
      title: s.title,
      special: s.special,
      specialAfter: s.specialAfter,
      custom: false,
    })),
    ...content.customSections.map((cs) => ({
      key: cs.key,
      title: cs.title,
      custom: true,
    })),
  ].map((s, i) => ({ ...s, number: i + 1 }));

  return (
    <div className="space-y-6">
      {/* Memorandum header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <FileText className="h-5 w-5 text-slate-500" />
          {t("Audit Planning Memorandum")}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/internal-audit/engagement/${engagementId}/apm-print`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-1" />
              {t("Download / Print")}
            </Button>
          </a>
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("Save")}
            </Button>
          )}
        </div>
      </div>

      {/* 17-section memorandum — labeled fields per section */}
      <Card>
        <CardContent className="space-y-8 pt-6 text-sm">
          {orderedSections.map((sec) => {
            const fields = content.sections[sec.key] ?? [];
            const after = Math.min(sec.specialAfter ?? fields.length, fields.length);
            return (
              <div key={sec.key} className="space-y-3 border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  {sec.custom ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-semibold text-slate-800 text-[15px] shrink-0">
                        {sec.number}.
                      </span>
                      {canEdit ? (
                        <Input
                          value={sec.title}
                          placeholder={t("Section title")}
                          onChange={(e) => setSectionTitle(sec.key, e.target.value)}
                          className="h-8 max-w-sm text-[15px] font-semibold text-slate-800"
                        />
                      ) : (
                        <span className="font-semibold text-slate-800 text-[15px]">
                          {sec.title || t("Untitled section")}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Label className="font-semibold text-slate-800 text-[15px]">
                      {sec.number}. {t(sec.title)}
                    </Label>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && fields.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-red-500"
                        onClick={() => openDeleteFields(sec.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {t("Delete Fields")}
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-slate-400 hover:text-red-500"
                        onClick={() => deleteSection(sec.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {t("Delete Section")}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {fields.slice(0, after).map((f) => renderField(sec.key, f))}
                  {sec.special === "triggerFactors" && triggerFactorsWidget}
                  {sec.special === "frameworkTable" && frameworkTableWidget}
                  {fields.slice(after).map((f) => renderField(sec.key, f))}

                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addField(sec.key)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t("Add Field")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}

          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={addSection}>
                <Plus className="h-4 w-4 mr-1" />
                {t("Add Section")}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("Save")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Program — inline working-paper entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-500" />
            {t("Audit Program")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {content.auditProgramRows.map((row, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t("Entry")} {i + 1}
                </span>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-400 hover:text-red-500"
                    disabled={content.auditProgramRows.length <= 1}
                    onClick={() => removeProgramRow(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {t("Delete Entry")}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                {APM_AUDIT_PROGRAM_COLUMNS.map((col) => (
                  <div key={col} className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500">{t(col)}</Label>
                    {canEdit ? (
                      <Textarea
                        rows={2}
                        className="min-h-[40px]"
                        value={row[col] ?? ""}
                        onChange={(e) => setProgramCell(i, col, e.target.value)}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-slate-600">{row[col] || "—"}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {canEdit && (
            <Button type="button" variant="outline" size="sm" onClick={addProgramRow}>
              <Plus className="h-4 w-4 mr-1" />
              {t("Add Entry")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Delete fields — multi-select checklist */}
      <Dialog
        open={!!deleteFieldsSection}
        onOpenChange={(o) => !o && setDeleteFieldsSection(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Delete Fields")}</DialogTitle>
            <DialogDescription>
              {t("Select the fields you want to delete from this section.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-[55vh] overflow-y-auto">
            {dialogFields.length > 0 ? (
              <>
                <label className="flex items-center gap-2.5 border-b border-slate-100 pb-2 mb-1 cursor-pointer">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleSelectAll(v === true)}
                  />
                  <span className="text-sm font-medium text-slate-700">{t("Select all")}</span>
                </label>
                {dialogFields.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-slate-50 cursor-pointer"
                  >
                    <Checkbox
                      checked={!!fieldSelection[f.id]}
                      onCheckedChange={(v) =>
                        setFieldSelection((s) => ({ ...s, [f.id]: v === true }))
                      }
                    />
                    <span className="text-sm text-slate-700">{fieldDisplayName(f)}</span>
                  </label>
                ))}
              </>
            ) : (
              <p className="text-sm text-slate-500 py-2">{t("No fields in this section.")}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFieldsSection(null)}>
              {t("Cancel")}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDeleteFields}
              disabled={selectedCount === 0}
            >
              {t("Delete")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
