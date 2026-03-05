"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Home, ChevronRight, FileText } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

export default function AsrTemplatePage() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/master-data/templates?limit=200");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data || []);
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

  // Group templates by category
  const groupedTemplates = templates.reduce<Record<string, Template[]>>((acc, tmpl) => {
    const cat = tmpl.category || "Default";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tmpl);
    return acc;
  }, {});

  // Add "All" category
  if (templates.length > 0) {
    groupedTemplates["All"] = templates;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment Template")}</span>
      </nav>

      <h1 className="text-2xl font-bold">{t("Assessment Template")}</h1>

      {/* Template categories */}
      <div className="space-y-6">
        {Object.entries(groupedTemplates).map(([category, tmplList]) => (
          <div key={category} className="rounded-lg border bg-card p-4">
            <h3 className="text-lg font-semibold mb-3">{t(category)}</h3>
            <div className="flex flex-wrap gap-3">
              {tmplList.map((tmpl) => (
                <button
                  key={tmpl.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{tmpl.name}</span>
                </button>
              ))}
            </div>
            {tmplList.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("No templates available")}</p>
            )}
          </div>
        ))}

        {Object.keys(groupedTemplates).length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {t("No templates available")}
          </div>
        )}
      </div>
    </div>
  );
}
