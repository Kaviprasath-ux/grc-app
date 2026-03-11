"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { Loader2, Home, ChevronRight, FileText, Search, X, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface QuestionLink {
  id: string;
  sortOrder: number;
  question: {
    id: string;
    questionNo: string;
    questionText: string;
    domain: { id: string; name: string } | null;
  };
}

interface Template {
  id: string;
  templateName: string;
  frameworkName: string | null;
  templateCategory: string;
  imageUrl: string | null;
  isActive: boolean;
  masterQuestionLinks: QuestionLink[];
}

export default function AsrTemplatePage() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/master-data/questionnaires");
      if (res.ok) {
        const json = await res.json();
        setTemplates(Array.isArray(json) ? json : json.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dynamic data translation for template names
  const { data: translatedTemplates } = useTranslatedData(templates, { modelName: 'TPRMQuestionnaireTemplate', idField: 'id' });

  const filtered = translatedTemplates.filter((tmpl) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tmpl.templateName.toLowerCase().includes(q) ||
      (tmpl.frameworkName || "").toLowerCase().includes(q) ||
      tmpl.templateCategory.toLowerCase().includes(q)
    );
  });

  // Group questions by domain for the detail view
  const groupByDomain = (links: QuestionLink[]) => {
    const groups: Record<string, { domain: string; questions: QuestionLink[] }> = {};
    for (const link of links) {
      const domainName = link.question.domain?.name || "General";
      if (!groups[domainName]) groups[domainName] = { domain: domainName, questions: [] };
      groups[domainName].questions.push(link);
    }
    return Object.values(groups);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment Template")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Assessment Templates")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("Questionnaire templates for vendor assessments")}</p>
        </div>
        <Badge variant="outline" className="self-start text-sm px-3 py-1">
          {filtered.length} {t("Templates")}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder={t("Search templates...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ltr:pl-9 rtl:pr-9"
        />
        {search && (
          <button className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Template Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-primary-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">{t("No templates found")}</p>
          <p className="text-xs text-slate-400">{t("Try adjusting your search")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((tmpl) => (
            <div
              key={tmpl.id}
              className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-primary-300 transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedTemplate(tmpl)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                {tmpl.imageUrl ? (
                  <img
                    src={tmpl.imageUrl}
                    alt={tmpl.templateName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-blue-50">
                    <FileText className="h-12 w-12 text-primary-300 mb-2" />
                    <span className="text-xs text-primary-400 font-medium">{t("Questionnaire")}</span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2.5 shadow-lg">
                    <Eye className="h-5 w-5 text-primary-600" />
                  </div>
                </div>
                {/* Category badge */}
                <div className="absolute top-2.5 ltr:right-2.5 rtl:left-2.5">
                  <Badge className="bg-white/90 text-slate-700 text-[10px] font-medium shadow-sm border-0">
                    {tmpl.templateCategory}
                  </Badge>
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold text-sm text-slate-800 line-clamp-1">{tmpl.templateName}</h3>
                {tmpl.frameworkName && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{tmpl.frameworkName}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-slate-400">
                    {tmpl.masterQuestionLinks.length} {t("Questions")}
                  </span>
                  {!tmpl.isActive && (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                      {t("Inactive")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Detail Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => { if (!open) setSelectedTemplate(null); }}>
        <DialogContent className="!max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedTemplate?.templateName}</DialogTitle>
            {selectedTemplate?.frameworkName && (
              <p className="text-sm text-muted-foreground">{selectedTemplate.frameworkName}</p>
            )}
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4 mt-2">
              {/* Template info */}
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline">{selectedTemplate.templateCategory}</Badge>
                <span className="text-slate-500">
                  {selectedTemplate.masterQuestionLinks.length} {t("Questions")}
                </span>
              </div>

              {/* Questions grouped by domain */}
              {groupByDomain(selectedTemplate.masterQuestionLinks).map((group) => (
                <div key={group.domain} className="border rounded-lg">
                  <div className="bg-slate-50 px-4 py-2.5 border-b">
                    <h4 className="font-semibold text-sm text-slate-700">{group.domain}</h4>
                    <span className="text-xs text-slate-400">{group.questions.length} {t("Questions")}</span>
                  </div>
                  <div className="divide-y">
                    {group.questions.map((link) => (
                      <div key={link.id} className="px-4 py-3 flex gap-3">
                        <span className="text-xs font-mono text-slate-400 mt-0.5 shrink-0">
                          {link.question.questionNo}
                        </span>
                        <p className="text-sm text-slate-700">{link.question.questionText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {selectedTemplate.masterQuestionLinks.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">{t("No questions in this template")}</p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>{t("Close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
