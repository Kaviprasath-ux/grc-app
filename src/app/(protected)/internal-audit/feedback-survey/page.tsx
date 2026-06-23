"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save, Download, ClipboardCheck, Home, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  FEEDBACK_SURVEY_SECTIONS,
  RATING_OPTIONS,
  SECTION_LABEL,
} from "@/lib/internal-audit/feedback-survey";

interface EngagementOption {
  id: string;
  auditId: string;
  engagementTitle: string | null;
}

interface CustomRow {
  key: string;
  text: string;
}

interface SurveyData {
  responses: Record<string, string>;
  comments: Record<string, string>;
  customRows: Record<string, CustomRow[]>;
  overallSatisfaction: number | null;
  didWell: string;
  improvements: string;
}

const EMPTY: SurveyData = {
  responses: {},
  comments: {},
  customRows: {},
  overallSatisfaction: null,
  didWell: "",
  improvements: "",
};

const ratingLabel = (v: string) => (v === "NA" ? "N/A" : v);

export default function FeedbackSurveyPage() {
  const { t } = useLanguage();
  const { canEdit } = usePermissions("audit.fieldwork");

  const [engagements, setEngagements] = useState<EngagementOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [survey, setSurvey] = useState<SurveyData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/internal-audit/engagements");
        if (!res.ok) return;
        const data = await res.json();
        const list: EngagementOption[] = (Array.isArray(data) ? data : []).map(
          (e: { id: string; auditId: string; engagementTitle: string | null }) => ({
            id: e.id,
            auditId: e.auditId,
            engagementTitle: e.engagementTitle,
          })
        );
        setEngagements(list);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const base = selectedId ? `/api/internal-audit/engagements/${selectedId}/feedback-survey` : "";

  const loadSurvey = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/internal-audit/engagements/${id}/feedback-survey`);
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      setSurvey({
        responses: d.responses || {},
        comments: d.comments || {},
        customRows: d.customRows || {},
        overallSatisfaction: d.overallSatisfaction ?? null,
        didWell: d.didWell || "",
        improvements: d.improvements || "",
      });
    } catch {
      toast.error(t("Failed to load feedback survey"));
      setSurvey(EMPTY);
    } finally {
      setLoading(false);
    }
  };

  const onSelect = (id: string) => {
    setSelectedId(id);
    void loadSurvey(id);
  };

  const setRating = (qKey: string, value: string) =>
    setSurvey((p) => ({ ...p, responses: { ...p.responses, [qKey]: value } }));
  const setComment = (sKey: string, value: string) =>
    setSurvey((p) => ({ ...p, comments: { ...p.comments, [sKey]: value } }));

  const addRow = (sKey: string) =>
    setSurvey((p) => {
      const key = `${sKey}_c_${Math.random().toString(36).slice(2, 9)}`;
      const rows = p.customRows[sKey] || [];
      return { ...p, customRows: { ...p.customRows, [sKey]: [...rows, { key, text: "" }] } };
    });
  const setRowText = (sKey: string, key: string, text: string) =>
    setSurvey((p) => ({
      ...p,
      customRows: {
        ...p.customRows,
        [sKey]: (p.customRows[sKey] || []).map((r) => (r.key === key ? { ...r, text } : r)),
      },
    }));
  const removeRow = (sKey: string, key: string) =>
    setSurvey((p) => {
      const resp = { ...p.responses };
      delete resp[key];
      return {
        ...p,
        responses: resp,
        customRows: { ...p.customRows, [sKey]: (p.customRows[sKey] || []).filter((r) => r.key !== key) },
      };
    });

  const save = async (): Promise<boolean> => {
    if (!selectedId) {
      toast.error(t("Select an engagement first."));
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(survey),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("Feedback survey saved"));
      return true;
    } catch {
      toast.error(t("Failed to save feedback survey"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    if (!(await save())) return;
    window.open(`${base}/download`, "_blank");
  };

  const head = "text-xs font-medium text-slate-500 uppercase tracking-wider";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Feedback Survey")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-slate-700" />
            {t("Internal Audit Engagement Feedback Survey")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t(
              "Obtain feedback on the effectiveness, professionalism, and value of the engagement (QAIP)."
            )}
          </p>
        </div>
        {selectedId && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={saving || loading}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Export PDF")}
            </Button>
            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving || loading}>
                {saving ? (
                  <Loader2 className="h-4 w-4 ltr:mr-2 rtl:ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                )}
                {t("Save")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Engagement selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <Label className="text-xs text-muted-foreground">{t("Audit Engagement")}</Label>
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="w-full sm:w-96">
            <SelectValue placeholder={t("Select an engagement")} />
          </SelectTrigger>
          <SelectContent>
            {engagements.length === 0 ? (
              <div className="px-2 py-3 text-xs text-slate-400 text-center">{t("No engagements found")}</div>
            ) : (
              engagements.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.auditId} — {e.engagementTitle || e.auditId}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {!selectedId ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
          {t("Select an engagement to fill in the feedback survey.")}
        </div>
      ) : loading ? (
        <div className="py-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin inline text-slate-400" />
        </div>
      ) : (
        <>
          {FEEDBACK_SURVEY_SECTIONS.map((section) => (
            <div key={section.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700">
                  {t(SECTION_LABEL[section.key])}
                </h3>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => addRow(section.key)}>
                    <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Add Row")}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className={`${head} text-left py-2 px-4 sm:px-5 min-w-[260px]`}>{t("Question")}</th>
                      {RATING_OPTIONS.map((r) => (
                        <th key={r} className={`${head} text-center py-2 px-1 w-12`}>
                          {ratingLabel(r)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.questions.map((q) => (
                      <tr key={q.key} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 px-4 sm:px-5 text-sm text-slate-700">{t(q.text)}</td>
                        {RATING_OPTIONS.map((r) => {
                          const selected = survey.responses[q.key] === r;
                          return (
                            <td key={r} className="py-2.5 px-1 text-center">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => setRating(q.key, r)}
                                className={`h-7 w-7 rounded-full border text-xs transition-colors ${
                                  selected
                                    ? "bg-primary-600 border-primary-600 text-white"
                                    : "border-slate-300 text-slate-500 hover:bg-slate-50"
                                }`}
                                aria-label={`${q.text} ${ratingLabel(r)}`}
                              >
                                {selected ? "✓" : ""}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {(survey.customRows[section.key] || []).map((row) => (
                      <tr key={row.key} className="border-b border-slate-100 last:border-0 bg-amber-50/30">
                        <td className="py-2 px-4 sm:px-5">
                          <div className="flex items-center gap-2">
                            <Input
                              value={row.text}
                              disabled={!canEdit}
                              placeholder={t("Enter question")}
                              onChange={(e) => setRowText(section.key, row.key, e.target.value)}
                              className="h-8 text-sm"
                            />
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => removeRow(section.key, row.key)}
                                className="text-slate-400 hover:text-red-500 shrink-0"
                                aria-label={t("Delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                        {RATING_OPTIONS.map((r) => {
                          const selected = survey.responses[row.key] === r;
                          return (
                            <td key={r} className="py-2 px-1 text-center">
                              <button
                                type="button"
                                disabled={!canEdit}
                                onClick={() => setRating(row.key, r)}
                                className={`h-7 w-7 rounded-full border text-xs transition-colors ${
                                  selected
                                    ? "bg-primary-600 border-primary-600 text-white"
                                    : "border-slate-300 text-slate-500 hover:bg-slate-50"
                                }`}
                              >
                                {selected ? "✓" : ""}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 sm:p-5 border-t border-slate-100">
                <Label className="text-xs text-muted-foreground">{t("Comments")}</Label>
                <Textarea
                  rows={2}
                  value={survey.comments[section.key] || ""}
                  disabled={!canEdit}
                  onChange={(e) => setComment(section.key, e.target.value)}
                />
              </div>
            </div>
          ))}

          {/* Overall satisfaction + open questions */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">{t("OVERALL SATISFACTION")}</h3>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t("Overall satisfaction with the audit engagement")}
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const selected = survey.overallSatisfaction === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setSurvey((p) => ({ ...p, overallSatisfaction: n }))}
                        className={`h-9 w-9 rounded-md border text-sm transition-colors ${
                          selected
                            ? "bg-primary-600 border-primary-600 text-white"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t("What did the audit team do particularly well?")}
                </Label>
                <Textarea
                  rows={3}
                  value={survey.didWell}
                  disabled={!canEdit}
                  onChange={(e) => setSurvey((p) => ({ ...p, didWell: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  {t("What improvements would you recommend?")}
                </Label>
                <Textarea
                  rows={3}
                  value={survey.improvements}
                  disabled={!canEdit}
                  onChange={(e) => setSurvey((p) => ({ ...p, improvements: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
