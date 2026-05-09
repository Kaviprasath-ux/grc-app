"use client";

/**
 * Authenticated V2 subscribe page.
 *
 * Reachable from /settings/subscription when the customer doesn't yet have a
 * Subscription envelope. Mirrors /signup/v2 step 2 — modules + General
 * billing cycle + 2-year contract consent — but skips the org/admin-user
 * creation since the customer already exists.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, Loader2, Sparkles, AlertCircle,
  Shield, Building2, ClipboardCheck, Home, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type BillingCycle = "MONTHLY" | "YEARLY";

interface PlanRow {
  moduleCode: ModuleCode;
  planType: "BASE" | "GENERAL";
  monthlyPrice: number | null;
  yearlyPrice: number;
}

const MODULE_META: Record<ModuleCode, { label: string; icon: React.ReactNode; description: string }> = {
  GRC:            { label: "GRC",            icon: <Shield className="h-5 w-5" />,         description: "Governance, Risk & Compliance" },
  TPRM:           { label: "TPRM",           icon: <Building2 className="h-5 w-5" />,      description: "Third-Party Risk Management" },
  INTERNAL_AUDIT: { label: "Internal Audit", icon: <ClipboardCheck className="h-5 w-5" />, description: "Audit planning, fieldwork & reporting" },
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function SubscribePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [pricing, setPricing] = useState<PlanRow[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedModules, setSelectedModules] = useState<Set<ModuleCode>>(new Set(["GRC"]));
  const [generalBillingCycle, setGeneralBillingCycle] = useState<BillingCycle>("YEARLY");
  const [contractAccepted, setContractAccepted] = useState(false);

  useEffect(() => {
    fetch("/api/public/plan-pricing")
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setPricing(j.data);
        else setError(j.error || "Failed to load plans");
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingPricing(false));
  }, []);

  function toggleModule(code: ModuleCode) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function isValid(): boolean {
    return selectedModules.size >= 1 && contractAccepted;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/settings/subscription/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modules: Array.from(selectedModules).map((c) => ({ moduleCode: c })),
          generalBillingCycle,
          contractAccepted: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Subscribe failed");

      toast({
        title: t("Subscription created"),
        description: t("Your modules are now active. Welcome aboard."),
      });
      router.push("/settings/subscription");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  // Compute pricing breakdown
  const selectedBaseRows = pricing.filter((p) => p.planType === "BASE" && selectedModules.has(p.moduleCode));
  const selectedGeneralRows = pricing.filter((p) => p.planType === "GENERAL" && selectedModules.has(p.moduleCode));
  const baseSubtotal = selectedBaseRows.reduce((s, r) => s + r.yearlyPrice, 0);
  const generalSubtotalMonthly = selectedGeneralRows.reduce((s, r) => s + (r.monthlyPrice ?? 0), 0);
  const generalSubtotalYearly = selectedGeneralRows.reduce((s, r) => s + r.yearlyPrice, 0);
  const baseTotalWithGst = Math.round(baseSubtotal * 1.18);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" /> {t("Home")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/subscription" className="hover:text-stone-900">{t("Subscription & Billing")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Subscribe")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t("Subscribe to Verifai GRC")}</h1>
        <p className="text-sm text-stone-600 mt-1">
          {t("Year 1 promotional plan, then standard pricing — 2-year commitment")}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-5 space-y-5">
          {/* Modules */}
          <div>
            <label className="text-base font-medium text-stone-900">{t("Select modules")}</label>
            <p className="text-xs text-stone-600 mb-3">
              {t("Each selected module starts a 2-year contract clock starting today.")}
            </p>
            <div className="space-y-2">
              {(Object.keys(MODULE_META) as ModuleCode[]).map((code) => (
                <label
                  key={code}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                    selectedModules.has(code) ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.has(code)}
                    onChange={() => toggleModule(code)}
                    className="h-4 w-4"
                  />
                  <div className="text-stone-700">{MODULE_META[code].icon}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{MODULE_META[code].label}</div>
                    <div className="text-xs text-stone-600">{t(MODULE_META[code].description)}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Billing cycle for General phase */}
          <div>
            <label className="text-base font-medium text-stone-900">{t("Year-2+ billing cycle")}</label>
            <p className="text-xs text-stone-600 mb-2">
              {t("After Year 1 (Base plan), the General plan auto-starts on this cycle")}
            </p>
            <div className="flex gap-2">
              {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setGeneralBillingCycle(c)}
                  className={`flex-1 p-3 rounded border text-sm font-medium transition ${
                    generalBillingCycle === c
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {c === "MONTHLY" ? t("Monthly") : t("Yearly")}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing breakdown */}
          {selectedModules.size > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-900 font-medium text-sm mb-2">
                <Sparkles className="h-4 w-4" />
                {t("Pricing breakdown")}
              </div>
              {loadingPricing ? (
                <div className="text-xs text-stone-600">{t("Loading…")}</div>
              ) : (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-700">{t("Year 1 (Base)")}</span>
                    <span className="font-mono">₹{formatINR(baseSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>{t("+ 18% GST")}</span>
                    <span className="font-mono">₹{formatINR(baseTotalWithGst - baseSubtotal)}</span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t border-emerald-200 mt-1">
                    <span>{t("Pay today")}</span>
                    <span className="font-mono">₹{formatINR(baseTotalWithGst)}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-emerald-200 text-xs text-stone-700">
                    {t("Year 2 onwards (General):")}{" "}
                    <span className="font-mono font-medium">
                      ₹{generalBillingCycle === "MONTHLY"
                        ? `${formatINR(generalSubtotalMonthly)}/mo`
                        : `${formatINR(generalSubtotalYearly)}/yr`}
                    </span>
                    {t(" + GST. Auto-debited.")}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Consent */}
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={contractAccepted}
                onCheckedChange={(v) => setContractAccepted(Boolean(v))}
                className="mt-0.5"
              />
              <div className="text-sm text-stone-800">
                <div className="font-medium mb-1">{t("I authorize the 2-year subscription")}</div>
                <p className="text-xs text-stone-700">
                  {t("Each module has a 2-year minimum commitment starting today. After Year 1 (Base plan) ends, the General plan auto-starts and recurring charges will be auto-debited from my saved payment method. Cancellation cannot take effect before the 2-year contract end.")}
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-between pt-2">
            <Link href="/settings/subscription">
              <Button variant="outline" disabled={submitting}>
                <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Back")}
              </Button>
            </Link>
            <Button onClick={submit} disabled={!isValid() || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                  {t("Subscribing…")}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Subscribe")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
