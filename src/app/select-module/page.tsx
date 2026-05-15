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
import { useSession } from "next-auth/react";
import { Shield, ClipboardCheck, ShieldCheck, Database, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModule } from "@/contexts/ModuleContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { moduleHomeForRoles, type ModuleCode } from "@/lib/url-module-map";
import { cn } from "@/lib/utils";

interface ModuleCard {
  code: ModuleCode;
  title: string;
  description: string;
  icon: typeof Shield;
  accent: string; // tailwind classes for the icon tile
}

const MODULE_CARDS: ModuleCard[] = [
  {
    code: "GRC",
    title: "GRC",
    description: "Governance, Risk, Compliance, and Asset Management",
    icon: Shield,
    accent: "bg-blue-50 text-blue-600",
  },
  {
    code: "INTERNAL_AUDIT",
    title: "Internal Audit",
    description: "Audit universe, planning, fieldwork, CAPA tracking",
    icon: ClipboardCheck,
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    code: "TPRM",
    title: "TPRM",
    description: "Third-Party Risk Management — vendor assessments and monitoring",
    icon: ShieldCheck,
    accent: "bg-purple-50 text-purple-600",
  },
  {
    code: "TECHNICAL_EVIDENCE",
    title: "Technical Evidence",
    description: "Automated control evidence collection from cloud and on-prem systems",
    icon: Database,
    accent: "bg-amber-50 text-amber-600",
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted p-4">
      <div className={cn("w-full", visibleCards.length === 4 ? "max-w-6xl" : "max-w-3xl")}>
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
              onClick={() => router.push("/login")}
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
              const Icon = card.icon;
              return (
                <button
                  key={card.code}
                  onClick={() => handleSelect(card.code)}
                  className="text-left group"
                >
                  <Card className="p-6 h-full hover:shadow-lg transition-shadow border-slate-200 group-hover:border-primary/40">
                    <div className={cn("inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4", card.accent)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{t(card.title)}</h3>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{t(card.description)}</p>
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
