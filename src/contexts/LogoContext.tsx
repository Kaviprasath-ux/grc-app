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
  const { status } = useSession();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Fetch fresh logo from API (called after upload/remove, and on initial mount
  // once the user is authenticated). The logo is NOT carried in the session JWT
  // because base64 data URLs blow up the Set-Cookie header and trip nginx's
  // proxy_buffer_size → 502.
  const refreshLogo = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/logo");
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.logoUrl || null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void refreshLogo();
    else if (status === "unauthenticated") setLogoUrl(null);
  }, [status, refreshLogo]);

  return (
    <LogoContext.Provider value={{ logoUrl, refreshLogo }}>
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  return useContext(LogoContext);
}
