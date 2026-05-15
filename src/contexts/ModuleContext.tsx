"use client";

/**
 * ModuleContext — tracks which module ("workspace") the user is currently
 * working in.
 *
 *   - currentModule:    the module the sidebar/header should render for
 *   - availableModules: modules the user has both a subscription to AND a role in
 *   - setCurrentModule: persist choice in cookie + localStorage
 *
 * The cookie is the source of truth for "current workspace" across reloads.
 * The URL is consulted only as a fallback (deep-link from email).
 *
 * Behaviour:
 *   - On mount: read cookie. If absent, infer from URL prefix.
 *     If both absent and there's exactly one available module, lock to it.
 *   - On URL change: if the URL belongs to a different module, update
 *     currentModule (and cookie) to match. Keeps the picker honest after
 *     manual nav.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { getModuleFromPath, type ModuleCode } from "@/lib/url-module-map";

const COOKIE_NAME = "currentModule";
const COOKIE_MAX_AGE_DAYS = 30;

interface ModuleContextValue {
  currentModule: ModuleCode | null;
  availableModules: ModuleCode[];
  setCurrentModule: (m: ModuleCode | null) => void;
  /** True for users in the super-admin namespace (GRCAdministrator). */
  isSystemUser: boolean;
}

const ModuleContext = createContext<ModuleContextValue | undefined>(undefined);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function writeCookie(name: string, value: string | null) {
  if (typeof document === "undefined") return;
  if (value === null) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function isModuleCode(v: unknown): v is ModuleCode {
  return v === "GRC" || v === "TPRM" || v === "INTERNAL_AUDIT" || v === "TECHNICAL_EVIDENCE";
}

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [currentModule, setCurrentModuleState] = useState<ModuleCode | null>(null);

  const isSystemUser = useMemo(
    () => Boolean(session?.user?.roles?.includes("GRCAdministrator")),
    [session?.user?.roles],
  );

  // Phase 5b.1: modules the user has subscription AND a role in.
  // session.user.roleModules is the distinct moduleCode set on the user's
  // UserRole rows (excluding system roles whose moduleCode is null).
  const availableModules = useMemo<ModuleCode[]>(() => {
    if (!session?.user) return [];
    if (isSystemUser) return []; // super-admin doesn't use the picker
    const subscribed = new Set<ModuleCode>();
    if (session.user.isGrcAdded) subscribed.add("GRC");
    if (session.user.isInternalAuditEnabled) subscribed.add("INTERNAL_AUDIT");
    if (session.user.isTprmAdded) subscribed.add("TPRM");
    if (session.user.isTechnicalEvidenceEnabled) subscribed.add("TECHNICAL_EVIDENCE");
    const userRoleModules = new Set(session.user.roleModules ?? []);
    return (["GRC", "INTERNAL_AUDIT", "TPRM", "TECHNICAL_EVIDENCE"] as ModuleCode[]).filter(
      (m) => subscribed.has(m) && userRoleModules.has(m),
    );
  }, [session?.user, isSystemUser]);

  // Initial-load reconciliation: cookie → URL → single-available fallback
  useEffect(() => {
    if (!session?.user) return;

    const fromCookie = readCookie(COOKIE_NAME);
    if (fromCookie && isModuleCode(fromCookie) && availableModules.includes(fromCookie)) {
      setCurrentModuleState(fromCookie);
      return;
    }

    const fromUrl = pathname ? getModuleFromPath(pathname) : null;
    if (fromUrl && fromUrl !== "SYSTEM" && availableModules.includes(fromUrl)) {
      setCurrentModuleState(fromUrl);
      writeCookie(COOKIE_NAME, fromUrl);
      return;
    }

    if (availableModules.length === 1) {
      setCurrentModuleState(availableModules[0]);
      writeCookie(COOKIE_NAME, availableModules[0]);
      return;
    }

    // 0 or 2+ modules — currentModule stays null until user picks one
    // (page.tsx redirect logic + Phase 6 layout gate take over).
    setCurrentModuleState(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, availableModules.join(",")]);

  // Keep currentModule in sync when the user navigates to a different module's
  // URL via header link / breadcrumb. Skips SYSTEM paths (super-admin).
  useEffect(() => {
    if (!pathname || !session?.user) return;
    const fromUrl = getModuleFromPath(pathname);
    if (!fromUrl || fromUrl === "SYSTEM") return;
    if (!availableModules.includes(fromUrl)) return;
    if (fromUrl === currentModule) return;
    setCurrentModuleState(fromUrl);
    writeCookie(COOKIE_NAME, fromUrl);
  }, [pathname, currentModule, session?.user, availableModules]);

  const setCurrentModule = useCallback((m: ModuleCode | null) => {
    setCurrentModuleState(m);
    writeCookie(COOKIE_NAME, m);
  }, []);

  const value: ModuleContextValue = {
    currentModule,
    availableModules,
    setCurrentModule,
    isSystemUser,
  };

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useModule(): ModuleContextValue {
  const ctx = useContext(ModuleContext);
  if (!ctx) {
    // Be permissive when used outside a provider (rare during migrations).
    return {
      currentModule: null,
      availableModules: [],
      setCurrentModule: () => {},
      isSystemUser: false,
    };
  }
  return ctx;
}
