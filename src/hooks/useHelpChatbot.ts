"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
  /** For bot messages: structured article result */
  article?: HelpArticle;
  /** For bot messages: multiple results when search returns > 1 */
  results?: ScoredResult[];
  /** Timestamp */
  timestamp: number;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "bot",
  content:
    "Hello! I can help you navigate the application. Type your question or browse by module below.",
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
  const pathname = usePathname();
  const { data: session } = useSession();

  // ─── Extract session flags ────────────────────────────────────────

  const userRoles = useMemo(
    () => (session?.user?.roles as string[]) || [],
    [session?.user?.roles]
  );

  /**
   * Product flags from session — determines GRC vs TPRM vs Audit visibility.
   * Mirrors the same isGrcAdded/isTprmAdded used by navigation and permissions.
   *
   * Audit isolation: users with ONLY audit roles (AuditHead, AuditManager,
   * Auditor, Auditee) see only Internal Audit content, not Organization/
   * Compliance/Risk/Assets modules.
   */
  const AUDIT_ROLES = useMemo(
    () => new Set(["AuditHead", "AuditManager", "Auditor", "Auditee"]),
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

  /** Modules visible to this user, with article counts. */
  const modulesWithCounts = useMemo(
    () => getVisibleModules(helpArticles, productFlags, userRoles),
    [productFlags, userRoles]
  );

  /** Context-aware suggestions based on current page. */
  const pageSuggestions = useMemo(
    () => getSuggestionsForPage(helpArticles, pathname, productFlags, userRoles),
    [pathname, productFlags, userRoles]
  );

  /** Articles for active module when category browsing. */
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
   * Send a user message and search the knowledge base.
   * Results are filtered by product scope — a TPRM-only user
   * will never see GRC articles, and vice versa.
   */
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setActiveModule(null);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      // Show user message + typing indicator
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      // Simulate a brief thinking delay, then show bot response
      setTimeout(() => {
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
      }, 800);
    },
    [userRoles, productFlags]
  );

  /** Select a specific article to display. */
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
    setMessages([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
    setActiveModule(null);
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
    // Alias
    helpModules: modulesWithCounts,
  };
}
