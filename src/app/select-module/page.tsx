"use client";

/**
 * Workspace picker — shown when a user has 2+ active module subscriptions.
 *
 * Behaviour:
 *   - Cards rendered for each module the user is both subscribed to AND
 *     has at least one role in.
 *   - Click a card → set ModuleContext + cookie, redirect to module home.
 *   - GRCAdministrator never lands here (page.tsx routes them to /grc).
 *   - Single-module users never land here either (page.tsx redirects them
 *     directly into their one module).
 *   - Empty state (zero available modules) → friendly message + sign out.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ArrowRight, LogOut, Database } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModule } from "@/contexts/ModuleContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { moduleHomeForRoles, type ModuleCode } from "@/lib/url-module-map";
import { cn } from "@/lib/utils";

interface ModuleCard {
  code: ModuleCode;
  description: string;
  logoSrc: string;   // /public path to the per-platform Glimmora wordmark
  logoAlt: string;
}

const MODULE_CARDS: ModuleCard[] = [
  {
    code: "GRC",
    description: "Governance, Risk, Compliance, and Asset Management",
    logoSrc: "/logo-grc.png",
    logoAlt: "Glimmora GRC",
  },
  {
    code: "INTERNAL_AUDIT",
    description: "Audit universe, planning, fieldwork, CAPA tracking",
    logoSrc: "/logo-internal-audit.png",
    logoAlt: "Glimmora Internal Audit",
  },
  {
    code: "TPRM",
    description: "Third-Party Risk Management — vendor assessments and monitoring",
    logoSrc: "/logo-tprm.png",
    logoAlt: "Glimmora TPRM",
  },
  {
    // Technical Evidence keeps the Glimmora VerifAI wordmark — per BA decision,
    // no dedicated TE-suffixed logo was produced.
    code: "TECHNICAL_EVIDENCE",
    description: "Automated control evidence collection from cloud and on-prem systems",
    logoSrc: "/logo.png",
    logoAlt: "Glimmora VerifAI — Technical Evidence",
  },
];

export default function SelectModulePage() {
  const { data: session, status } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  const { availableModules, setCurrentModule } = useModule();

  // If unauthenticated, kick to login.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // GRCAdministrator should never reach this page — bounce them home.
  useEffect(() => {
    if (session?.user?.roles?.includes("GRCAdministrator")) {
      router.replace("/grc");
    }
  }, [session, router]);

  // If the user happens to have only one available module, send them straight in.
  useEffect(() => {
    if (status === "authenticated" && availableModules.length === 1) {
      const only = availableModules[0];
      setCurrentModule(only);
      router.replace(moduleHomeForRoles(only, session?.user?.roles ?? []));
    }
  }, [status, availableModules, setCurrentModule, router, session?.user?.roles]);

  const handleSelect = (m: ModuleCode) => {
    setCurrentModule(m);
    router.push(moduleHomeForRoles(m, session?.user?.roles ?? []));
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const visibleCards = MODULE_CARDS.filter((c) => availableModules.includes(c.code));

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.replace("/login");
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted p-4">
      {/* Logout — top-right corner. Useful when the user landed here by mistake
          (no available modules, or wants to switch accounts without picking a workspace). */}
      <div className="absolute top-4 ltr:right-4 rtl:left-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 gap-2"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Log out")}</span>
        </Button>
      </div>

      <div className={cn("w-full", visibleCards.length === 4 ? "max-w-6xl" : "max-w-3xl")}>
        {/* Glimmora VerifAI brand banner — the unifying mark above the
            workspace cards. Each card below shows its own platform-specific
            Glimmora wordmark (Glimmora GRC / TPRM / Internal Audit), while
            Technical Evidence keeps this same Verifai mark. */}
        <div className="flex justify-center mb-4">
          <img
            src="/logo.png"
            alt="Glimmora VerifAI"
            className="h-20 w-auto max-w-[300px] object-contain"
          />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            {t("Select a workspace")}
          </h1>
          <p className="mt-2 text-slate-500">
            {session?.user?.name ? t(`Welcome, ${session.user.name}.`) : ""}{" "}
            {t("Choose a workspace to begin. You can switch any time from the sidebar.")}
          </p>
        </div>

        {visibleCards.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-slate-700 font-medium">
              {t("No active workspaces")}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {t("Your account doesn't have an active subscription for any module yet, or no role has been assigned. Please contact your administrator.")}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={handleLogout}
            >
              {t("Back to login")}
            </Button>
          </Card>
        ) : (
          <div
            className={cn(
              "grid gap-4",
              visibleCards.length === 1 && "grid-cols-1 max-w-md mx-auto",
              visibleCards.length === 2 && "grid-cols-1 sm:grid-cols-2",
              visibleCards.length === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
              visibleCards.length === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
            )}
          >
            {visibleCards.map((card) => {
              // Technical Evidence has no dedicated wordmark logo — render an
              // icon + title text card instead of the image-only card design.
              const isTextCard = card.code === "TECHNICAL_EVIDENCE";
              return (
                <button
                  key={card.code}
                  onClick={() => handleSelect(card.code)}
                  className="text-left group"
                >
                  <Card className="p-6 h-full hover:shadow-lg transition-shadow border-slate-200 group-hover:border-primary/40 flex flex-col gap-3">
                    {isTextCard ? (
                      <>
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-600 mx-auto">
                          <Database className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 text-center">
                          {t("Verifai Technical Evidence")}
                        </h3>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-16">
                        <img
                          src={card.logoSrc}
                          alt={card.logoAlt}
                          className="h-full w-auto max-w-full object-contain"
                        />
                      </div>
                    )}
                    <p className="text-sm text-slate-500 text-center">{t(card.description)}</p>
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-400 mt-auto pt-2 border-t border-slate-100">
                      <span>{t("Open workspace")}</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
