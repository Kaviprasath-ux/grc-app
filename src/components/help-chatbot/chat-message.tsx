"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { HelpArticle } from "@/data/help-knowledge-base";
import type { ScoredResult } from "@/lib/help-search";
import { ExternalLink, User, Bot, ShieldAlert, Sparkles, BookOpen, Database, Pencil, Check, X } from "lucide-react";
import { SpeakerButton } from "./voice/SpeakerButton";

interface ChatMessageProps {
  /** Stable message id used to highlight which message is being read aloud. */
  messageId?: string;
  role: "user" | "bot";
  content: string;
  article?: HelpArticle;
  results?: ScoredResult[];
  sources?: { articleKey: string; question: string; similarity: number }[];
  confidence?: "high" | "medium" | "low";
  blocked?: boolean;
  isRAG?: boolean;
  isDataQuery?: boolean;
  isAgentUpdate?: boolean;
  pendingUpdateId?: string;
  executed?: boolean;
  confirmationResult?: "confirmed" | "cancelled";
  onSelectArticle?: (article: HelpArticle) => void;
  onConfirmUpdate?: (updateId: string, confirm: boolean) => void;
  /** TTS controls — supplied by parent; omit to hide the speaker button. */
  speakingId?: string | null;
  isSpeaking?: boolean;
  isLoadingSpeech?: boolean;
  onSpeak?: (text: string, id: string) => void;
  onStopSpeak?: () => void;
}

export function ChatMessage({
  messageId,
  role,
  content,
  article,
  results,
  sources,
  confidence,
  blocked,
  isRAG,
  isDataQuery,
  isAgentUpdate,
  pendingUpdateId,
  executed,
  confirmationResult,
  onSelectArticle,
  onConfirmUpdate,
  speakingId,
  isSpeaking,
  isLoadingSpeech,
  onSpeak,
  onStopSpeak,
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
        <div className={cn(
          "rounded-2xl rounded-bl-sm border px-4 py-2.5 text-sm space-y-3",
          blocked
            ? "bg-red-50 border-red-200"
            : "bg-slate-50 border-slate-200"
        )}>
          {/* Blocked indicator */}
          {blocked && (
            <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium">
              <ShieldAlert className="w-3.5 h-3.5" />
              {t("Request blocked by security policy")}
            </div>
          )}

          {/* Article-based response (Phase 1 style) */}
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
            /* RAG or plain text response */
            <div>
              {/* AI badge for RAG responses */}
              {isRAG && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  <span className="text-[10px] font-medium text-purple-600 uppercase tracking-wider">
                    {t("AI Generated")}
                  </span>
                </div>
              )}
              {/* Data query badge */}
              {isDataQuery && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Database className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">
                    {t("Data Query")}
                  </span>
                </div>
              )}
              {/* Agent update badge */}
              {isAgentUpdate && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Pencil className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">
                    {executed ? t("Updated") : t("Agent Update")}
                  </span>
                </div>
              )}
              <div
                className="text-slate-700 chatbot-markdown"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
            </div>
          )}

          {/* Source citations (RAG) */}
          {sources && sources.length > 0 && !article && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {t("Sources")}
              </p>
              <div className="space-y-0.5">
                {sources.slice(0, 3).map((source) => (
                  <div
                    key={source.articleKey}
                    className="text-xs text-slate-500 flex items-center gap-1"
                  >
                    <span className="text-primary-600">{source.question}</span>
                    <span className="text-slate-300">
                      ({Math.round(source.similarity * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent update confirmation buttons — show only when no result yet */}
          {isAgentUpdate && pendingUpdateId && !executed && !confirmationResult && onConfirmUpdate && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onConfirmUpdate(pendingUpdateId, true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {t("Yes, Update")}
              </button>
              <button
                onClick={() => onConfirmUpdate(pendingUpdateId, false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t("Cancel")}
              </button>
            </div>
          )}
          {/* Show confirmation result text after user clicks */}
          {isAgentUpdate && confirmationResult && (
            <div className={cn(
              "flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium w-fit",
              confirmationResult === "confirmed"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            )}>
              {confirmationResult === "confirmed" ? (
                <><Check className="w-3.5 h-3.5" /> {t("Confirmed")}</>
              ) : (
                <><X className="w-3.5 h-3.5" /> {t("Cancelled")}</>
              )}
            </div>
          )}

          {/* Confidence indicator (RAG or Data Query) */}
          {confidence && (isRAG || isDataQuery) && (
            <div className="mt-1">
              <span
                className={cn(
                  "inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  confidence === "high" && "bg-green-100 text-green-700",
                  confidence === "medium" && "bg-amber-100 text-amber-700",
                  confidence === "low" && "bg-red-100 text-red-700"
                )}
              >
                {confidence === "high" && t("High confidence")}
                {confidence === "medium" && t("Medium confidence")}
                {confidence === "low" && t("Low confidence")}
              </span>
            </div>
          )}

          {/* Other matching results (Phase 1 related questions) */}
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

          {/* Read-aloud control */}
          {onSpeak && onStopSpeak && messageId && getSpeakableText(content, article) && (
            <div className="flex items-center justify-end pt-1 -mb-1 -mr-1">
              <SpeakerButton
                text={getSpeakableText(content, article)}
                messageId={messageId}
                speakingId={speakingId ?? null}
                isSpeaking={isSpeaking ?? false}
                isLoading={isLoadingSpeech ?? false}
                onSpeak={onSpeak}
                onStop={onStopSpeak}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Build a TTS-friendly version of the message:
 *  - For article responses, prefer the article's prose answer (skip nav links).
 *  - For RAG/plain text, strip markdown so it doesn't get spoken literally.
 */
function getSpeakableText(content: string, article?: HelpArticle): string {
  if (article) {
    const parts = [article.answer];
    if (article.steps?.length) {
      parts.push(article.steps.map((s, i) => `${i + 1}. ${s}`).join(". "));
    }
    return stripMarkdown(parts.join(". "));
  }
  return stripMarkdown(content);
}

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[#>`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

/**
 * Lightweight markdown renderer for chatbot responses.
 * Handles: bold, bullet lists, numbered lists, headings, paragraphs.
 */
function renderMarkdown(text: string): string {
  // Sanitize HTML entities first (prevent XSS)
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Split into lines for block-level processing
  const lines = safe.split("\n");
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

  const applyInline = (s: string) =>
    s.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Check for numbered list: "1. text" or "1) text"
    const olMatch = raw.match(/^\s*(\d+)[.)]\s+(.+)/);
    if (olMatch) {
      if (inUl) { htmlParts.push("</ul>"); inUl = false; }
      if (!inOl) { htmlParts.push('<ol class="list-decimal list-inside space-y-0.5 my-1 text-slate-700">'); inOl = true; }
      htmlParts.push(`<li>${applyInline(olMatch[2])}</li>`);
      continue;
    }

    // Check for bullet list: "- text" or "• text"
    const ulMatch = raw.match(/^\s*[-•]\s+(.+)/);
    if (ulMatch) {
      if (inOl) { htmlParts.push("</ol>"); inOl = false; }
      if (!inUl) { htmlParts.push('<ul class="list-disc list-inside space-y-0.5 my-1 text-slate-700">'); inUl = true; }
      htmlParts.push(`<li>${applyInline(ulMatch[1])}</li>`);
      continue;
    }

    const line = applyInline(raw);

    // Close any open list
    if (inUl) { htmlParts.push("</ul>"); inUl = false; }
    if (inOl) { htmlParts.push("</ol>"); inOl = false; }

    // Empty line → spacing
    if (line.trim() === "") {
      htmlParts.push('<div class="h-1.5"></div>');
      continue;
    }

    // Regular paragraph
    htmlParts.push(`<p class="my-0.5">${line}</p>`);
  }

  // Close any remaining open list
  if (inUl) htmlParts.push("</ul>");
  if (inOl) htmlParts.push("</ol>");

  return htmlParts.join("");
}

/**
 * Animated typing indicator with bouncing dots
 */
export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="rounded-2xl rounded-bl-sm bg-slate-50 border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
