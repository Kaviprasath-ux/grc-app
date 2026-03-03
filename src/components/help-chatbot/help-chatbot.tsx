"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircleQuestion, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHelpChatbot } from "@/hooks/useHelpChatbot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      {!isOpen && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleOpen}
                className={cn(
                  "fixed bottom-6 z-50 flex items-center justify-center",
                  "w-14 h-14 rounded-full shadow-lg",
                  "bg-primary-500 hover:bg-primary-600 text-white",
                  "transition-all duration-200 hover:scale-105",
                  "ltr:right-6 rtl:left-6"
                )}
                aria-label={t("Help Assistant")}
              >
                <MessageCircleQuestion className="w-6 h-6" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={isRTL ? "right" : "left"}>
              <p>
                {t("Need help?")} <kbd className="text-[10px] ml-1 opacity-60">F1</kbd>
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Chat Sheet Panel */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side={isRTL ? "left" : "right"}
          className="w-[400px] sm:max-w-[400px] p-0 flex flex-col gap-0 [&>button:last-child]:hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white p-4 flex items-center justify-between flex-shrink-0">
            <SheetHeader className="p-0 gap-0">
              <SheetTitle className="text-white text-base font-semibold flex items-center gap-2">
                <MessageCircleQuestion className="w-5 h-5" />
                {t("Help Assistant")}
              </SheetTitle>
              <SheetDescription className="text-primary-100 text-xs">
                {t("Ask anything about the application")}
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                title={t("Clear chat")}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={close}
                className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 min-h-0">
            <div ref={scrollRef} className="p-4 space-y-1">
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
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-slate-200 p-3 flex-shrink-0">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t("Type your question...")}
                className="flex-1 text-sm h-10"
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputValue.trim()}
                className="h-10 w-10 bg-primary-500 hover:bg-primary-600 flex-shrink-0"
              >
                <Send className={cn("w-4 h-4", isRTL && "rotate-180")} />
              </Button>
            </form>
            <p className="text-[10px] text-slate-400 mt-1.5 text-center">
              {t("Press")} <kbd className="font-mono text-[10px]">F1</kbd>{" "}
              {t("to toggle help")}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
