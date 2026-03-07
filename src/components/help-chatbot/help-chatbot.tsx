"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircleQuestion, Send, Trash2, X, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHelpChatbot } from "@/hooks/useHelpChatbot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./chat-message";
import { ModuleCards, ModuleArticleList } from "./suggested-questions";
import { helpModules as allModules } from "@/data/help-knowledge-base";

export function HelpChatbot() {
  const { t, isRTL } = useLanguage();
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    isOpen,
    toggleOpen,
    close,
    messages,
    sendMessage,
    selectArticle,
    clearChat,
    activeModule,
    browseModule,
    backToModules,
    moduleArticles,
    modulesWithCounts,
    pageSuggestions,
  } = useHelpChatbot();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue("");
  };

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  // Find module name for active module
  const activeModuleName =
    activeModule
      ? allModules.find((m) => m.id === activeModule)?.name || ""
      : "";

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={toggleOpen}
        className={cn(
          "fixed bottom-6 z-50 flex items-center justify-center",
          "w-14 h-14 rounded-full shadow-lg",
          "transition-all duration-300",
          isOpen
            ? "bg-slate-600 hover:bg-slate-700 scale-90"
            : "bg-primary-500 hover:bg-primary-600 hover:scale-105",
          "text-white",
          "ltr:right-6 rtl:left-6"
        )}
        aria-label={t("Help Assistant")}
      >
        {isOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircleQuestion className="w-6 h-6" />
        )}
      </button>

      {/* Floating Chat Window */}
      <div
        className={cn(
          "fixed z-50 flex flex-col",
          "ltr:right-6 rtl:left-6 bottom-24",
          "w-[380px] max-h-[560px]",
          "bg-white rounded-2xl shadow-2xl border border-slate-200",
          "transition-all duration-300 origin-bottom-right",
          isOpen
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white px-4 py-3.5 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <MessageCircleQuestion className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">
                {t("Help Assistant")}
              </h3>
              <p className="text-[11px] text-primary-100 leading-tight">
                {t("Ask anything about the application")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
              title={t("Clear chat")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
              title={t("Minimize")}
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0 p-4 space-y-1"
          style={{ maxHeight: "400px" }}
        >
          {/* Chat messages */}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              article={msg.article}
              results={msg.results}
              onSelectArticle={selectArticle}
            />
          ))}

          {/* Module browsing or suggestions (shown after welcome) */}
          {messages.length <= 1 && !activeModule && (
            <ModuleCards
              modules={modulesWithCounts}
              onSelectModule={browseModule}
              pageSuggestions={pageSuggestions}
              onSelectArticle={(article) => {
                handleQuickQuestion(article.question);
              }}
            />
          )}

          {/* Module article list when browsing a category */}
          {activeModule && (
            <ModuleArticleList
              moduleName={activeModuleName}
              articles={moduleArticles}
              onSelectArticle={(article) => {
                selectArticle(article);
              }}
              onBack={backToModules}
            />
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 p-3 flex-shrink-0 rounded-b-2xl">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("Type your question...")}
              className="flex-1 text-sm h-9 rounded-full px-4 bg-slate-50 border-slate-200 focus-visible:ring-primary-500/20"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim()}
              className="h-9 w-9 rounded-full bg-primary-500 hover:bg-primary-600 flex-shrink-0"
            >
              <Send className={cn("w-4 h-4", isRTL && "rotate-180")} />
            </Button>
          </form>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            <kbd className="font-mono text-[10px]">F1</kbd>{" "}
            {t("to toggle help")}
          </p>
        </div>
      </div>
    </>
  );
}
