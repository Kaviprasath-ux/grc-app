"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

export interface ThemeOption {
  id: string;
  name: string;
  color: string; // Preview swatch color (primary-500 equivalent)
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "terracotta", name: "Terracotta", color: "#A57865", description: "Warm earthy tone" },
  { id: "ocean", name: "Ocean Blue", color: "#4A7FA8", description: "Professional blue" },
  { id: "forest", name: "Forest Green", color: "#4A8F6A", description: "Nature-inspired green" },
  { id: "royal", name: "Royal Purple", color: "#7B68A5", description: "Elegant purple" },
  { id: "slate", name: "Slate Gray", color: "#6B7B8D", description: "Modern neutral" },
  { id: "crimson", name: "Crimson Red", color: "#A5484A", description: "Bold corporate red" },
  { id: "teal", name: "Teal", color: "#14B8A6", description: "Fresh teal" },
  { id: "amber", name: "Amber Gold", color: "#D97706", description: "Warm golden" },
  { id: "indigo", name: "Indigo Navy", color: "#6366F1", description: "Deep indigo" },
  { id: "rose", name: "Rose Pink", color: "#E11D48", description: "Vibrant rose" },
  { id: "orange", name: "Orange", color: "#EA580C", description: "Bold orange" },
  { id: "emerald", name: "Emerald", color: "#10B981", description: "Rich emerald" },
  { id: "coffee", name: "Coffee Brown", color: "#8B6914", description: "Classic brown" },
  { id: "sky", name: "Sky Blue", color: "#0EA5E9", description: "Bright sky" },
];

interface ThemeContextType {
  theme: string;
  setTheme: (theme: string) => void;
  themeOptions: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "terracotta",
  setTheme: () => {},
  themeOptions: THEME_OPTIONS,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [theme, setThemeState] = useState<string>("terracotta");
  const [loaded, setLoaded] = useState(false);

  // Only apply theme when user is logged in; reset to default on login page
  useEffect(() => {
    if (!session?.user) {
      // No session (login page) — always show default terracotta
      setThemeState("terracotta");
      applyThemeClass("terracotta");
      setLoaded(true);
      return;
    }
    // Logged in — load from localStorage immediately to avoid flash
    const stored = localStorage.getItem("grc-theme");
    if (stored) {
      setThemeState(stored);
      applyThemeClass(stored);
    }
    setLoaded(true);
  }, [session?.user]);

  // Fetch org theme from API when session loads
  useEffect(() => {
    if (!session?.user?.customerAccountId) return;
    fetch(`/api/settings/theme`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.theme) {
          setThemeState(data.theme);
          applyThemeClass(data.theme);
          localStorage.setItem("grc-theme", data.theme);
        }
      })
      .catch(() => {});
  }, [session?.user?.customerAccountId]);

  const applyThemeClass = (themeId: string) => {
    const html = document.documentElement;
    // Remove all theme classes
    THEME_OPTIONS.forEach(t => html.classList.remove(`theme-${t.id}`));
    // Add current theme class (default terracotta needs no class)
    if (themeId !== "terracotta") {
      html.classList.add(`theme-${themeId}`);
    }
  };

  const setTheme = useCallback(async (themeId: string) => {
    setThemeState(themeId);
    applyThemeClass(themeId);
    localStorage.setItem("grc-theme", themeId);

    // Save to API (for org-wide persistence)
    try {
      await fetch("/api/settings/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: themeId }),
      });
    } catch {
      // Silently fail - local storage still works
    }
  }, []);

  // Prevent flash of wrong theme
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeOptions: THEME_OPTIONS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
