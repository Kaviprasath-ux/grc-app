"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  helpArticles,
  type HelpArticle,
  type HelpModule,
} from "@/data/help-knowledge-base";
import {
  searchKnowledgeBase,
  getArticlesByModule,
  getSuggestionsForPage,
  getVisibleModules,
  type ScoredResult,
  type ProductFlags,
} from "@/lib/help-search";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  /** For bot messages: structured article result (Phase 1 style) */
  article?: HelpArticle;
  /** For bot messages: multiple results when search returns > 1 */
  results?: ScoredResult[];
  /** For bot messages: source citations from RAG */
  sources?: { articleKey: string; question: string; similarity: number }[];
  /** For bot messages: AI confidence level */
  confidence?: "high" | "medium" | "low";
  /** Whether this message was blocked by guardrails */
  blocked?: boolean;
  /** Whether this is a RAG-generated answer (vs Phase 1 keyword match) */
  isRAG?: boolean;
  /** Whether this is a data query response (NLP-to-SQL) */
  isDataQuery?: boolean;
  /** Whether this is an agent update message */
  isAgentUpdate?: boolean;
  /** Pending update ID for confirmation */
  pendingUpdateId?: string;
  /** Whether the update was executed */
  executed?: boolean;
  /** Result of the confirmation action */
  confirmationResult?: "confirmed" | "cancelled";
  /** Timestamp */
  timestamp: number;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "bot",
  content:
    "Hello! I'm the AI-powered GRC Help Assistant. Ask me anything about the application — I can provide detailed answers from the knowledge base.",
  timestamp: Date.now(),
};

interface UseHelpChatbotOptions {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useHelpChatbot({ isOpen, onOpenChange }: UseHelpChatbotOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeModule, setActiveModule] = useState<HelpModule | null>(null);
  const [agentMode, setAgentMode] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Extract session flags ────────────────────────────────────────

  const userRoles = useMemo(
    () => (session?.user?.roles as string[]) || [],
    [session?.user?.roles]
  );

  const AUDIT_ROLES = useMemo(
    () => new Set(["AuditHead", "Auditor", "Auditor", "Auditee"]),
    []
  );

  const productFlags: ProductFlags = useMemo(() => {
    const isAuditUser = userRoles.some((r) => AUDIT_ROLES.has(r));
    const isAuditOnly =
      isAuditUser &&
      userRoles.length > 0 &&
      userRoles.every((r) => AUDIT_ROLES.has(r));

    return {
      isGrcAdded: (session?.user?.isGrcAdded as boolean) ?? true,
      isTprmAdded: (session?.user?.isTprmAdded as boolean) ?? false,
      isAuditUser,
      isAuditOnly,
    };
  }, [session?.user?.isGrcAdded, session?.user?.isTprmAdded, userRoles, AUDIT_ROLES]);

  // ─── Keyboard shortcut: F1 ───────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        onOpenChange(!isOpen);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onOpenChange]);

  // ─── Derived data (all filtered by product scope + role) ─────────

  const modulesWithCounts = useMemo(
    () => getVisibleModules(helpArticles, productFlags, userRoles),
    [productFlags, userRoles]
  );

  const pageSuggestions = useMemo(
    () => getSuggestionsForPage(helpArticles, pathname, productFlags, userRoles),
    [pathname, productFlags, userRoles]
  );

  const moduleArticles = useMemo(() => {
    if (!activeModule) return [];
    return getArticlesByModule(helpArticles, activeModule, productFlags, userRoles);
  }, [activeModule, productFlags, userRoles]);

  // ─── Actions ─────────────────────────────────────────────────────

  const toggleOpen = useCallback(() => {
    onOpenChange(!isOpen);
  }, [isOpen, onOpenChange]);

  const open = useCallback(() => onOpenChange(true), [onOpenChange]);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  /**
   * Send a user message — tries RAG API first, falls back to Phase 1 keyword search.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setActiveModule(null);

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      // Build conversation history from recent messages
      const recentMessages = messages
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        // Try RAG API
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            conversationHistory: recentMessages,
            agentMode,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: "bot",
          content: data.answer,
          article: data.article || undefined,
          sources: data.sources || [],
          confidence: data.confidence || "medium",
          blocked: data.blocked || false,
          isRAG: !data.fallback && !data.article && !data.isDataQuery && !data.isAgentUpdate,
          isDataQuery: data.isDataQuery || false,
          isAgentUpdate: data.isAgentUpdate || false,
          pendingUpdateId: data.pendingUpdateId || undefined,
          executed: data.executed || false,
          timestamp: Date.now(),
        };

        setIsTyping(false);
        setMessages((prev) => [...prev, botMsg]);
      } catch (error) {
        // If aborted, don't show error
        if ((error as Error).name === "AbortError") {
          setIsTyping(false);
          return;
        }

        console.warn("[Chatbot] RAG API failed, falling back to Phase 1:", error);

        // Fallback to Phase 1 keyword search
        const results = searchKnowledgeBase(trimmed, helpArticles, {
          roleFilter: userRoles,
          productFlags,
        });

        let botMsg: ChatMessage;

        if (results.length === 0) {
          botMsg = {
            id: `bot-${Date.now()}`,
            role: "bot",
            content:
              "This information is not available in the current User Manual. Please contact the administrator.",
            timestamp: Date.now(),
          };
        } else if (results.length === 1 || results[0].score >= 80) {
          botMsg = {
            id: `bot-${Date.now()}`,
            role: "bot",
            content: results[0].article.answer,
            article: results[0].article,
            timestamp: Date.now(),
          };
        } else {
          botMsg = {
            id: `bot-${Date.now()}`,
            role: "bot",
            content: results[0].article.answer,
            article: results[0].article,
            results,
            timestamp: Date.now(),
          };
        }

        setIsTyping(false);
        setMessages((prev) => [...prev, botMsg]);
      }
    },
    [userRoles, productFlags, messages, agentMode]
  );

  /** Select a specific article to display (Phase 1 style — direct display). */
  const selectArticle = useCallback((article: HelpArticle) => {
    setActiveModule(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: article.question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        content: article.answer,
        article,
        timestamp: Date.now(),
      };
      setIsTyping(false);
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  }, []);

  /** Browse a module category. */
  const browseModule = useCallback((module: HelpModule) => {
    setActiveModule(module);
  }, []);

  /** Go back to module list from category view. */
  const backToModules = useCallback(() => {
    setActiveModule(null);
  }, []);

  /** Clear chat and reset to welcome state. */
  const clearChat = useCallback(() => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
    setActiveModule(null);
    setIsTyping(false);
  }, []);

  /** Confirm or cancel a pending agent update */
  const confirmUpdate = useCallback(async (updateId: string, confirm: boolean) => {
    // Mark the confirmation message with the user's choice (replaces buttons with text)
    setMessages((prev) =>
      prev.map((msg) =>
        msg.pendingUpdateId === updateId
          ? { ...msg, confirmationResult: confirm ? "confirmed" : "cancelled" }
          : msg
      )
    );

    if (!confirm) {
      // User cancelled
      const cancelMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        content: "Update cancelled. No changes were made.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, cancelMsg]);
      return;
    }

    setIsTyping(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmUpdateId: updateId }),
      });

      const data = await response.json();

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        content: data.answer,
        confidence: data.confidence || "high",
        isAgentUpdate: true,
        executed: data.executed || false,
        timestamp: Date.now(),
      };

      setIsTyping(false);
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "bot",
          content: "An error occurred while confirming the update. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    }
  }, []);

  return {
    isOpen,
    isTyping,
    toggleOpen,
    open,
    close,
    messages,
    sendMessage,
    selectArticle,
    clearChat,
    // Module browsing
    activeModule,
    browseModule,
    backToModules,
    moduleArticles,
    modulesWithCounts,
    // Context-aware
    pageSuggestions,
    // Agent mode
    agentMode,
    setAgentMode,
    confirmUpdate,
    // Alias
    helpModules: modulesWithCounts,
  };
}
