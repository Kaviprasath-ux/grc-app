"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircleQuestion, Send, Trash2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHelpChatbot } from "@/hooks/useHelpChatbot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage, TypingIndicator } from "./chat-message";
import { ModuleCards, ModuleArticleList } from "./suggested-questions";
import { helpModules as allModules } from "@/data/help-knowledge-base";
import { MicButton } from "./voice/MicButton";
import { VoiceSettings } from "./voice/VoiceSettings";
import { useSpeak } from "@/hooks/useSpeak";
import { useChatbotVoiceSettings } from "@/hooks/useChatbotVoiceSettings";

interface HelpChatbotProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpChatbot({ isOpen, onOpenChange }: HelpChatbotProps) {
  const { t, isRTL } = useLanguage();
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isTyping,
    sendMessage,
    selectArticle,
    clearChat,
    activeModule,
    browseModule,
    backToModules,
    moduleArticles,
    modulesWithCounts,
    pageSuggestions,
    agentMode,
    setAgentMode,
    confirmUpdate,
  } = useHelpChatbot({ isOpen, onOpenChange });

  const panelRef = useRef<HTMLDivElement>(null);

  // Voice features
  const { settings, setAutoSpeak, setVoice } = useChatbotVoiceSettings();
  const speak = useSpeak();
  const lastSpokenIdRef = useRef<string | null>(null);
  // True when the user's most recent message came in via the mic — used to
  // mirror voice-in → voice-out for that single turn.
  const lastInputWasVoiceRef = useRef(false);

  // Auto-scroll to bottom when messages change or typing starts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Auto-speak: read newly arrived bot messages aloud when either:
  //   (a) the user sent the previous message via voice (mirror it back), or
  //   (b) the user opted into "Auto-speak replies" globally.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "bot") return;
    if (last.id === "welcome") return;
    if (last.id === lastSpokenIdRef.current) return;

    const shouldSpeak = settings.autoSpeak || lastInputWasVoiceRef.current;
    if (!shouldSpeak) return;

    lastSpokenIdRef.current = last.id;
    // Consume the voice-input flag — only the immediate reply gets read aloud.
    lastInputWasVoiceRef.current = false;
    void speak.speak(last.content, last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, settings.autoSpeak]);

  // Stop any in-flight TTS when the chatbot closes.
  useEffect(() => {
    if (!isOpen) speak.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onOpenChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const value = inputValue;
    setInputValue("");
    speak.stop();
    lastInputWasVoiceRef.current = false;
    void sendMessage(value);
  };

  // Voice transcript came in — submit it as a user message immediately.
  const handleTranscript = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInputValue("");
    speak.stop();
    lastInputWasVoiceRef.current = true;
    void sendMessage(trimmed);
  };

  // Find module name for active module
  const activeModuleName =
    activeModule
      ? allModules.find((m) => m.id === activeModule)?.name || ""
      : "";

  return (
    <>
      {/* Chat Window — anchored below header */}
      <div
        ref={panelRef}
        className={cn(
          "fixed z-40 flex flex-col",
          "ltr:right-4 rtl:left-4 top-[72px]",
          "w-[380px] max-h-[calc(100vh-88px)]",
          "bg-white rounded-2xl shadow-2xl border border-slate-200",
          "transition-all duration-300 origin-top-right",
          isOpen
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-4 pointer-events-none"
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
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 ltr:mr-1 rtl:ml-1" title={agentMode ? t("Agent Mode ON - Can update records") : t("Enable Agent Mode")}>
              <span className={cn(
                "text-[10px] font-medium uppercase tracking-wider transition-colors",
                agentMode ? "text-amber-300" : "text-white/40"
              )}>
                {t("Agent")}
              </span>
              <Switch
                checked={agentMode}
                onCheckedChange={setAgentMode}
                className="h-4 w-7 data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white/20"
              />
            </div>
            <VoiceSettings
              settings={settings}
              onAutoSpeakChange={setAutoSpeak}
              onVoiceChange={setVoice}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                speak.stop();
                clearChat();
              }}
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
              title={t("Clear chat")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10 rounded-full"
              title={t("Close")}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0 p-4 space-y-1"
        >
          {/* Chat messages */}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              messageId={msg.id}
              role={msg.role}
              content={msg.content}
              article={msg.article}
              results={msg.results}
              sources={msg.sources}
              confidence={msg.confidence}
              blocked={msg.blocked}
              isRAG={msg.isRAG}
              isDataQuery={msg.isDataQuery}
              isAgentUpdate={msg.isAgentUpdate}
              pendingUpdateId={msg.pendingUpdateId}
              executed={msg.executed}
              confirmationResult={msg.confirmationResult}
              onSelectArticle={selectArticle}
              onConfirmUpdate={confirmUpdate}
              speakingId={speak.speakingId}
              isSpeaking={speak.isSpeaking}
              isLoadingSpeech={speak.isLoading}
              onSpeak={speak.speak}
              onStopSpeak={speak.stop}
            />
          ))}

          {/* Typing indicator */}
          {isTyping && <TypingIndicator />}

          {/* Module browsing or suggestions (shown after welcome) */}
          {messages.length <= 1 && !activeModule && (
            <ModuleCards
              modules={modulesWithCounts}
              onSelectModule={browseModule}
              pageSuggestions={pageSuggestions}
              onSelectArticle={selectArticle}
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
            <MicButton
              onTranscript={handleTranscript}
              onRecordingStart={() => speak.stop()}
              disabled={isTyping}
            />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t("Type your question...")}
              className="flex-1 text-sm h-9 rounded-full px-4 bg-slate-50 border-slate-200 focus-visible:ring-primary-500/20"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isTyping}
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
