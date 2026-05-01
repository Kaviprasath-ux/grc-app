"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Home, ChevronRight, ArrowLeft, ArrowUp, Loader2, AlertCircle, Mail, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";
type BillingCycle = "MONTHLY" | "YEARLY";

const TIER_RANK: Record<PlanTier, number> = { BASIC: 0, MEDIUM: 1, PRO: 2 };
const TIER_ORDER: PlanTier[] = ["BASIC", "MEDIUM", "PRO"];

interface ActiveModule {
  id: string;
  moduleCode: ModuleCode;
  tier: PlanTier;
  billingCycle: BillingCycle;
  unitPrice: number;
  cycleEnd: string;
}

interface UpgradeQuote {
  lineItems: Array<{
    moduleCode: ModuleCode;
    currentTier: PlanTier;
    newTier: PlanTier;
    cycle: BillingCycle;
    currentPrice: number;
    newPrice: number;
    diff: number;
    monthsCharged: number;
    isProRated: boolean;
    unitPrice: number;
    description: string;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

const MODULE_META: Record<ModuleCode, { label: string; icon: string }> = {
  GRC:            { label: "GRC",            icon: "🛡️" },
  TPRM:           { label: "TPRM",           icon: "👥" },
  INTERNAL_AUDIT: { label: "Internal Audit", icon: "🔍" },
};
const TIER_BADGE: Record<PlanTier, string> = {
  BASIC:  "bg-stone-100 text-stone-700 border-stone-300",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-300",
  PRO:    "bg-amber-100 text-amber-800 border-amber-300",
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface Selection { moduleCode: ModuleCode; currentTier: PlanTier; targetTier: PlanTier; }

export default function UpgradePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModules, setActiveModules] = useState<ActiveModule[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [quote, setQuote] = useState<UpgradeQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/subscription");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Load failed");
        if (cancelled) return;
        if (!json.data) {
          setError(t("No subscription configured."));
          return;
        }
        if (json.data.subscriptionType === "COMPLIMENTARY") {
          setError(t("Complimentary subscriptions cannot be upgraded. Please contact your administrator."));
          return;
        }
        const active = json.data.modules.filter((m: ActiveModule & { cancelledAt: string | null }) => !m.cancelledAt);
        setActiveModules(active);
        // Default selection: each module's targetTier = currentTier (no change yet)
        setSelections(active.map((m: ActiveModule) => ({
          moduleCode: m.moduleCode,
          currentTier: m.tier,
          targetTier: m.tier,
        })));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  // Only modules where target > current count as upgrades
  const upgradeRequests = useMemo(
    () => selections
      .filter((s) => TIER_RANK[s.targetTier] > TIER_RANK[s.currentTier])
      .map((s) => ({ moduleCode: s.moduleCode, newTier: s.targetTier })),
    [selections]
  );

  const fetchQuote = useCallback(async () => {
    if (upgradeRequests.length === 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await fetch("/api/settings/subscription/upgrade/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upgrades: upgradeRequests }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Quote failed");
      setQuote(json.data);
    } catch (e) {
      toast({ variant: "destructive", title: t("Quote failed"), description: (e as Error).message });
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [upgradeRequests, toast, t]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  function setTargetTier(moduleCode: ModuleCode, tier: PlanTier) {
    setSelections((prev) => prev.map((s) => (s.moduleCode === moduleCode ? { ...s, targetTier: tier } : s)));
  }

  async function proceedToPayment() {
    if (!quote || upgradeRequests.length === 0) return;
    setSubmitting(true);
    try {
      toast({
        title: t("Payment integration coming in Step 26"),
        description: t("Upgrade quote ready: ₹") + formatINR(quote.total),
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-stone-600">{t("Loading…")}</div>;

  if (error) {
    return (
      <div className="p-8 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-stone-400" />
            <p className="text-stone-900 font-medium">{error}</p>
            <Link href="/settings/subscription">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("Back to Subscription")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeModules.length === 0) {
    return (
      <div className="p-8 max-w-2xl">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-stone-400" />
            <p className="text-stone-900 font-medium">{t("No active modules to upgrade")}</p>
            <p className="text-sm text-stone-600 mt-1">{t("Use Add Module to subscribe to one first.")}</p>
            <div className="flex justify-center gap-2 mt-4">
              <Link href="/settings/subscription"><Button variant="outline">{t("Back")}</Button></Link>
              <Link href="/settings/subscription/add-module"><Button>{t("Add Module")}</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />{t("Home")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/subscription" className="hover:text-stone-900">{t("Subscription & Billing")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Upgrade Tier")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t("Upgrade Tier")}</h1>
        <p className="mt-1 text-stone-600">
          {t("Move modules to a higher tier mid-cycle. You're charged the pro-rated difference for the months remaining.")}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* LEFT: per-module upgrade picker */}
        <div className="lg:col-span-2 space-y-4">
          {selections.map((s) => {
            const meta = MODULE_META[s.moduleCode];
            const mod = activeModules.find((m) => m.moduleCode === s.moduleCode);
            const currentRank = TIER_RANK[s.currentTier];
            return (
              <Card key={s.moduleCode}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <div className="font-semibold">{meta.label}</div>
                        <div className="text-xs text-stone-500">
                          {t("Current cycle ends")}: {mod ? formatDate(mod.cycleEnd) : "—"}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={TIER_BADGE[s.currentTier]}>
                      {t("Currently")}: {s.currentTier}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {TIER_ORDER.map((tier) => {
                      const rank = TIER_RANK[tier];
                      const isCurrent = rank === currentRank;
                      const isDowngrade = rank < currentRank;
                      const isSelected = s.targetTier === tier && rank > currentRank;
                      return (
                        <button
                          key={tier}
                          onClick={() => !isDowngrade && !isCurrent && setTargetTier(s.moduleCode, tier)}
                          disabled={isCurrent || isDowngrade}
                          className={`p-3 rounded-md border-2 text-left transition-all ${
                            isCurrent
                              ? "border-stone-300 bg-stone-100 text-stone-500 cursor-not-allowed"
                              : isDowngrade
                              ? "border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed line-through"
                              : isSelected
                              ? `border-stone-900 ${TIER_BADGE[tier]}`
                              : "border-stone-200 bg-white hover:border-stone-400"
                          }`}
                        >
                          <div className="font-semibold text-sm flex items-center gap-1">
                            {tier}
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <div className="text-[10px] mt-0.5">
                            {isCurrent ? t("Current") : isDowngrade ? t("Downgrade — contact sales") : t("Upgrade")}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Downgrade CTA */}
          <Card className="bg-stone-50 border-dashed">
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-stone-500" />
              <div className="text-sm text-stone-700 flex-1">
                {t("Need to downgrade or change billing cycle? Contact our sales team.")}
              </div>
              <a
                href="mailto:sales@verifai.com?subject=Subscription downgrade request"
                className="text-sm text-stone-900 font-medium hover:underline"
              >
                {t("Contact sales")}
              </a>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: live quote */}
        <div>
          <Card className="sticky top-6">
            <CardHeader className="border-b border-stone-200 py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{t("Upgrade Charge")}</span>
                {quoteLoading && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {upgradeRequests.length === 0 ? (
                <div className="text-sm text-stone-600 py-4 text-center">
                  {t("Pick a higher tier on at least one module.")}
                </div>
              ) : !quote ? (
                <div className="text-sm text-stone-500 py-4">{t("Loading quote…")}</div>
              ) : (
                <>
                  {quote.lineItems.map((li) => (
                    <div key={li.moduleCode} className="text-sm">
                      <div className="text-stone-900">{li.description}</div>
                      <div className="flex items-center justify-between text-xs text-stone-600 mt-1">
                        <span className="flex items-center gap-1">
                          <Badge variant="outline" className={TIER_BADGE[li.currentTier]}>{li.currentTier}</Badge>
                          <ArrowUp className="h-3 w-3" />
                          <Badge variant="outline" className={TIER_BADGE[li.newTier]}>{li.newTier}</Badge>
                        </span>
                        <span className="font-mono text-stone-900">₹{formatINR(li.unitPrice)}</span>
                      </div>
                      {li.isProRated && (
                        <div className="text-[10px] text-stone-500 mt-0.5">
                          {t("of")} ₹{formatINR(li.diff)} ({li.monthsCharged}/12 {t("months remaining")})
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="border-t border-stone-200 pt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-stone-700">
                      <span>{t("Subtotal")}</span>
                      <span className="font-mono">₹{formatINR(quote.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-stone-700">
                      <span>{t("GST")} ({quote.taxRate}%)</span>
                      <span className="font-mono">₹{formatINR(quote.taxAmount)}</span>
                    </div>
                  </div>

                  <div className="border-t border-stone-200 pt-3 flex justify-between items-baseline">
                    <span className="font-semibold text-stone-900">{t("Total today")}</span>
                    <span className="font-mono font-semibold text-xl text-stone-900">₹{formatINR(quote.total)}</span>
                  </div>

                  <div className="text-xs text-stone-500">
                    {t("New tier limits apply immediately. Future renewals at the new tier rate.")}
                  </div>
                </>
              )}

              <Button
                className="w-full mt-2"
                disabled={upgradeRequests.length === 0 || !quote || submitting}
                onClick={proceedToPayment}
              >
                {submitting ? t("Processing…") : t("Proceed to Payment")}
              </Button>

              <Link href="/settings/subscription" className="block text-center text-sm text-stone-600 hover:text-stone-900">
                {t("Cancel")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
