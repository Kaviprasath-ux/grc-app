"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { HelpArticle, HelpModule, HelpModuleInfo } from "@/data/help-knowledge-base";
import {
  HelpCircle, Building2, Shield, AlertTriangle, Package,
  ClipboardCheck, Network, Settings, ArrowLeft,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  HelpCircle, Building2, Shield, AlertTriangle, Package,
  ClipboardCheck, Network, Settings,
};

interface ModuleCardsProps {
  modules: (HelpModuleInfo & { count: number })[];
  onSelectModule: (module: HelpModule) => void;
  pageSuggestions?: HelpArticle[];
  onSelectArticle: (article: HelpArticle) => void;
}

export function ModuleCards({
  modules,
  onSelectModule,
  pageSuggestions,
  onSelectArticle,
}: ModuleCardsProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 px-1">
      {/* Page-aware suggestions */}
      {pageSuggestions && pageSuggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {t("Suggested for this page")}
          </p>
          <div className="space-y-1">
            {pageSuggestions.map((article) => (
              <button
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="block w-full text-start text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-3 py-1.5 rounded-md transition-colors"
              >
                {article.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Module category cards */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {t("Browse by Module")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {modules.map((mod) => {
            const Icon = iconMap[mod.icon] || HelpCircle;
            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-lg border border-slate-200",
                  "hover:border-primary-300 hover:bg-primary-50/50 transition-all text-start"
                )}
              >
                <Icon className="w-4 h-4 text-primary-500" />
                <span className="text-xs font-medium text-slate-800">
                  {t(mod.name)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {mod.count} {t("topics")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ModuleArticleListProps {
  moduleName: string;
  articles: HelpArticle[];
  onSelectArticle: (article: HelpArticle) => void;
  onBack: () => void;
}

export function ModuleArticleList({
  moduleName,
  articles,
  onSelectArticle,
  onBack,
}: ModuleArticleListProps) {
  const { t } = useLanguage();

  // Group articles by category
  const grouped: Record<string, HelpArticle[]> = {};
  for (const a of articles) {
    if (!grouped[a.category]) grouped[a.category] = [];
    grouped[a.category].push(a);
  }

  return (
    <div className="space-y-3 px-1">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        {t("Back to modules")}
      </button>

      <h3 className="text-sm font-semibold text-slate-800">{t(moduleName)}</h3>

      {Object.entries(grouped).map(([category, arts]) => (
        <div key={category}>
          <p className="text-xs font-medium text-slate-500 mb-1">
            {t(category)}
          </p>
          <div className="space-y-0.5">
            {arts.map((article) => (
              <button
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className="block w-full text-start text-sm text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-3 py-1.5 rounded-md transition-colors"
              >
                {article.question}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
