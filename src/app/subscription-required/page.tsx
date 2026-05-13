"use client";

/**
 * Blocking page shown when a user lands on a route belonging to a module
 * the customer hasn't subscribed to (or whose subscription has expired).
 *
 * Phase 5a — page exists but the layout-level redirect that lands users
 * here is wired in Phase 6. Today this page is reachable only by manual
 * navigation or from the picker's empty state.
 */
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function SubscriptionRequiredInner() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const router = useRouter();

  const moduleCode = params.get("module") ?? "";
  const moduleLabel =
    moduleCode === "GRC"
      ? "GRC"
      : moduleCode === "INTERNAL_AUDIT"
        ? "Internal Audit"
        : moduleCode === "TPRM"
          ? "TPRM"
          : "this module";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-background to-muted p-4">
      <Card className="w-full max-w-md p-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 text-amber-600 mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          {t("Subscription required")}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t(`Your account does not have an active subscription for ${moduleLabel}. Contact your administrator to enable it, or pick a different workspace.`)}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => router.push("/select-module")}>
            {t("Choose another workspace")}
          </Button>
          <Button variant="outline" onClick={() => router.push("/settings/subscription")}>
            {t("Manage subscription")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function SubscriptionRequiredPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SubscriptionRequiredInner />
    </Suspense>
  );
}
