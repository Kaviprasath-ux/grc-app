"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { HelpArticle } from "@/data/help-knowledge-base";
import type { ScoredResult } from "@/lib/help-search";
import { ExternalLink, User, Bot } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "bot";
  content: string;
  article?: HelpArticle;
  results?: ScoredResult[];
  onSelectArticle?: (article: HelpArticle) => void;
}

export function ChatMessage({
  role,
  content,
  article,
  results,
  onSelectArticle,
}: ChatMessageProps) {
  const { t } = useLanguage();
  const router = useRouter();

  if (role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div className="rounded-2xl rounded-br-sm bg-primary-500 text-white px-4 py-2.5 text-sm">
            {content}
          </div>
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-primary-700" />
          </div>
        </div>
      </div>
    );
  }

  // Bot message
  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-start gap-2 max-w-[90%]">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="rounded-2xl rounded-bl-sm bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm space-y-3">
          {/* Overview */}
          {article ? (
            <div>
              <p className="font-medium text-slate-800 mb-1">
                {article.answer}
              </p>

              {/* Steps */}
              {article.steps && article.steps.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {t("Steps")}
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700">
                    {article.steps.map((step, i) => (
                      <li key={i} className="text-sm">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: formatBold(step),
                          }}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Notes */}
              {article.notes && article.notes.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">
                    {t("Notes")}
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                    {article.notes.map((note, i) => (
                      <li key={i} className="text-xs">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Links */}
              {article.relatedLinks && article.relatedLinks.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {t("Related")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {article.relatedLinks.map((link) => (
                      <button
                        key={link.href}
                        onClick={() => router.push(link.href)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-2 py-1 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {t(link.label)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-700">{content}</p>
          )}

          {/* Other matching results */}
          {results && results.length > 1 && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {t("Related Questions")}
              </p>
              <div className="space-y-1">
                {results.slice(1, 4).map((r) => (
                  <button
                    key={r.article.id}
                    onClick={() => onSelectArticle?.(r.article)}
                    className={cn(
                      "block w-full text-start text-xs text-primary-600 hover:text-primary-800",
                      "hover:bg-primary-50 px-2 py-1 rounded transition-colors"
                    )}
                  >
                    {r.article.question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple bold formatting: **text** → <strong>text</strong>
 */
function formatBold(text: string): string {
  return text.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="font-semibold text-slate-900">$1</strong>'
  );
}
