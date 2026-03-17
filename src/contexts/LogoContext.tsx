"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface LogoContextType {
  logoUrl: string | null;
  refreshLogo: () => Promise<void>;
}

const LogoContext = createContext<LogoContextType>({
  logoUrl: null,
  refreshLogo: async () => {},
});

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Initialize from session
  useEffect(() => {
    if (session?.user?.customerLogoUrl !== undefined) {
      setLogoUrl(session.user.customerLogoUrl);
    }
  }, [session?.user?.customerLogoUrl]);

  // Fetch fresh logo from API (called after upload/remove)
  const refreshLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/logo");
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.logoUrl || null);
      }
    } catch { /* ignore */ }
  }, []);

  return (
    <LogoContext.Provider value={{ logoUrl, refreshLogo }}>
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  return useContext(LogoContext);
}
