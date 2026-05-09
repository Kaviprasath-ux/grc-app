"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ChevronRight, ArrowLeft, Tag, Loader2, AlertCircle, Calendar, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RazorpayOptions, RazorpayResponse, RazorpayInstance } from "@/types/razorpay";

interface PendingPayment {
  invoiceId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  prefill: { email?: string; name?: string };
  stubMode?: boolean;
  stubPaymentId?: string;
}

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";
type BillingCycle = "MONTHLY" | "YEARLY";

interface ActiveModuleSummary {
  moduleCode: ModuleCode;
  tier: PlanTier;
  billingCycle: BillingCycle;
  cycleEnd: string;
}

interface Quote {
  cycle: BillingCycle;
  currency: string;
  lineItems: Array<{
    moduleCode: ModuleCode;
    tier: PlanTier;
    description: string;
    unitPrice: number;
    fullCyclePrice: number;
    monthsCharged: number;
    isProRated: boolean;
    priceSource: "STANDARD" | "OVERRIDE";
  }>;
  subtotal: number;
  bundleDiscount: { id: string; name: string; amount: number } | null;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  anchor: { cycleEnd: string | null; monthsRemaining: number; isProRated: boolean };
  alreadyActive: Array<{ moduleCode: ModuleCode; tier: PlanTier; cycleEnd: string }>;
}

const MODULE_META: Record<ModuleCode, { label: string; icon: string; description: string }> = {
  GRC:            { label: "GRC",            icon: "🛡️", description: "Governance, Risk & Compliance" },
  TPRM:           { label: "TPRM",           icon: "👥", description: "Third-Party Risk Management" },
  INTERNAL_AUDIT: { label: "Internal Audit", icon: "🔍", description: "Audit planning, fieldwork & reporting" },
};
const ALL_MODULES: ModuleCode[] = ["GRC", "TPRM", "INTERNAL_AUDIT"];
const TIER_BADGE: Record<PlanTier, string> = {
  BASIC:  "bg-stone-100 text-stone-700 border-stone-300",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-300",
  PRO:    "bg-amber-100 text-amber-800 border-amber-300",
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface Selection { moduleCode: ModuleCode; tier: PlanTier; enabled: boolean; }

export default function AddModulePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModules, setActiveModules] = useState<ActiveModuleSummary[]>([]);
  const [selections, setSelections] = useState<Selection[]>(
    ALL_MODULES.map((m) => ({ moduleCode: m, tier: "BASIC", enabled: false }))
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const razorpayScriptLoaded = useRef(false);

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
          setError(t("Complimentary subscriptions cannot self-add modules. Please contact your administrator."));
          return;
        }
        setActiveModules(
          json.data.modules.filter((m: ActiveModuleSummary & { cancelledAt: string | null }) => !m.cancelledAt)
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const activeCodes = useMemo(() => new Set(activeModules.map((m) => m.moduleCode)), [activeModules]);

  // Available = modules NOT already active
  const availableSelections = useMemo(
    () => selections.filter((s) => !activeCodes.has(s.moduleCode)),
    [selections, activeCodes]
  );

  const enabledLines = useMemo(
    () => availableSelections.filter((s) => s.enabled).map((s) => ({ moduleCode: s.moduleCode, tier: s.tier })),
    [availableSelections]
  );

  const fetchQuote = useCallback(async () => {
    if (enabledLines.length === 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await fetch("/api/settings/subscription/add-module/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: enabledLines }),
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
  }, [enabledLines, toast, t]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  // Load Razorpay script
  useEffect(() => {
    if (razorpayScriptLoaded.current) return;
    if (document.getElementById("razorpay-script")) {
      razorpayScriptLoaded.current = true;
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => { razorpayScriptLoaded.current = true; };
    document.body.appendChild(script);
  }, []);

  async function completeAddModule(response: RazorpayResponse, invoiceId: string) {
    try {
      const res = await fetch("/api/settings/subscription/add-module/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payment completion failed");

      toast({ title: t("Success"), description: t("Modules added successfully!") });
      setPendingPayment(null);
      router.push(json.data.redirectUrl || "/settings/subscription?added=1");
    } catch (e) {
      setPaymentError((e as Error).message);
      toast({ variant: "destructive", title: t("Error"), description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  function openRazorpayCheckout(payment: PendingPayment) {
    // Handle stub mode for testing
    if (payment.stubMode && payment.stubPaymentId) {
      const stubResponse: RazorpayResponse = {
        razorpay_payment_id: payment.stubPaymentId,
        razorpay_order_id: payment.orderId,
        razorpay_signature: "stub_signature_" + Date.now(),
      };
      completeAddModule(stubResponse, payment.invoiceId);
      return;
    }

    if (!window.Razorpay) {
      toast({ variant: "destructive", title: t("Error"), description: t("Payment system not loaded. Please refresh.") });
      setSubmitting(false);
      return;
    }

    const options: RazorpayOptions = {
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      order_id: payment.orderId,
      name: "GRC Platform",
      description: "Add Module",
      prefill: payment.prefill,
      theme: { color: "#1c1917" },
      handler: (response: RazorpayResponse) => {
        completeAddModule(response, payment.invoiceId);
      },
      modal: {
        ondismiss: () => {
          setSubmitting(false);
          toast({ title: t("Payment Cancelled"), description: t("You can retry when ready.") });
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  function updateSelection(moduleCode: ModuleCode, patch: Partial<Selection>) {
    setSelections((prev) => prev.map((s) => (s.moduleCode === moduleCode ? { ...s, ...patch } : s)));
  }

  async function proceedToPayment() {
    if (!quote || enabledLines.length === 0) return;
    setSubmitting(true);
    setPaymentError(null);

    try {
      const res = await fetch("/api/settings/subscription/add-module/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: enabledLines }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payment initiation failed");

      const payment: PendingPayment = {
        invoiceId: json.data.invoiceId,
        orderId: json.data.orderId,
        amount: json.data.amount,
        currency: json.data.currency,
        keyId: json.data.keyId,
        prefill: json.data.prefill || {},
        stubMode: json.data.stubMode,
        stubPaymentId: json.data.stubPaymentId,
      };

      setPendingPayment(payment);
      openRazorpayCheckout(payment);
    } catch (e) {
      setPaymentError((e as Error).message);
      toast({ variant: "destructive", title: t("Error"), description: (e as Error).message });
      setSubmitting(false);
    }
  }

  function retryPayment() {
    if (!pendingPayment) return;
    setPaymentError(null);
    setSubmitting(true);
    openRazorpayCheckout(pendingPayment);
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

  const noModulesAvailable = ALL_MODULES.every((m) => activeCodes.has(m));

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />{t("Home")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/subscription" className="hover:text-stone-900">{t("Subscription & Billing")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Add Module")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t("Add a Module")}</h1>
        <p className="mt-1 text-stone-600">
          {t("New modules align with your existing renewal date. Pro-rated for the months remaining.")}
        </p>
      </div>

      {noModulesAvailable ? (
        <Card>
          <CardContent className="py-12 text-center text-stone-600">
            <Check className="h-10 w-10 mx-auto mb-3 text-green-600" />
            <p className="font-medium text-stone-900">{t("All modules already subscribed")}</p>
            <p className="text-sm mt-1">{t("To upgrade an existing module's tier, use Upgrade Tier instead.")}</p>
            <div className="flex justify-center gap-2 mt-4">
              <Link href="/settings/subscription">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Back")}
                </Button>
              </Link>
              <Link href="/settings/subscription/upgrade">
                <Button>{t("Upgrade Tier")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* LEFT: module list */}
          <div className="lg:col-span-2 space-y-5">
            {/* Already-active modules (read-only display) */}
            {activeModules.length > 0 && (
              <Card>
                <CardHeader className="border-b border-stone-200 py-3">
                  <CardTitle className="text-base">{t("Currently Subscribed")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {activeModules.map((m, idx) => {
                    const meta = MODULE_META[m.moduleCode];
                    return (
                      <div
                        key={m.moduleCode}
                        className={`p-4 ${idx > 0 ? "border-t border-stone-100" : ""} flex items-center gap-3 opacity-60`}
                      >
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span className="text-xl">{meta.icon}</span>
                        <div className="flex-1">
                          <div className="font-medium">{meta.label}</div>
                          <div className="text-xs text-stone-500">
                            {t("Renews")} {formatDate(m.cycleEnd)}
                          </div>
                        </div>
                        <Badge variant="outline" className={TIER_BADGE[m.tier]}>{m.tier}</Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Available modules with selectors */}
            <Card>
              <CardHeader className="border-b border-stone-200 py-3">
                <CardTitle className="text-base">{t("Available Modules")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {availableSelections.map((s, idx) => {
                  const meta = MODULE_META[s.moduleCode];
                  return (
                    <div
                      key={s.moduleCode}
                      className={`p-4 ${idx > 0 ? "border-t border-stone-100" : ""} flex items-center gap-3`}
                    >
                      <Checkbox
                        checked={s.enabled}
                        onCheckedChange={(v) => updateSelection(s.moduleCode, { enabled: !!v })}
                        id={`mod-${s.moduleCode}`}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`mod-${s.moduleCode}`} className="flex items-center gap-2 cursor-pointer">
                          <span className="text-xl">{meta.icon}</span>
                          <span className="font-medium">{meta.label}</span>
                        </Label>
                        <p className="text-xs text-stone-600 mt-0.5">{t(meta.description)}</p>
                      </div>
                      <div className={`flex gap-1 ${s.enabled ? "" : "opacity-30 pointer-events-none"}`}>
                        {(["BASIC", "MEDIUM", "PRO"] as PlanTier[]).map((tier) => (
                          <button
                            key={tier}
                            onClick={() => updateSelection(s.moduleCode, { tier })}
                            className={`px-3 py-1 rounded-md text-xs font-medium border ${
                              s.tier === tier
                                ? TIER_BADGE[tier]
                                : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                            }`}
                          >
                            {tier}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: live quote */}
          <div>
            <Card className="sticky top-6">
              <CardHeader className="border-b border-stone-200 py-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{t("Quote")}</span>
                  {quoteLoading && <Loader2 className="h-4 w-4 animate-spin text-stone-500" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {enabledLines.length === 0 ? (
                  <div className="text-sm text-stone-600 py-4 text-center">
                    {t("Select at least one module.")}
                  </div>
                ) : !quote ? (
                  <div className="text-sm text-stone-500 py-4">{t("Loading quote…")}</div>
                ) : (
                  <>
                    {/* Pro-rata anchor info */}
                    {quote.anchor.cycleEnd && (
                      <div className="rounded-md bg-blue-50 border border-blue-200 p-2.5 text-xs text-blue-900 flex gap-2">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <div>
                          {quote.anchor.isProRated ? (
                            <>
                              {t("Aligned to your renewal date")}: <strong>{formatDate(quote.anchor.cycleEnd)}</strong>
                              {" — "}{quote.anchor.monthsRemaining} {t("month(s) pro-rated")}
                            </>
                          ) : (
                            <>{t("Aligned to your renewal date")}: <strong>{formatDate(quote.anchor.cycleEnd)}</strong></>
                          )}
                        </div>
                      </div>
                    )}

                    {quote.lineItems.map((li) => (
                      <div key={`${li.moduleCode}-${li.tier}`} className="text-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-stone-900">{li.description}</div>
                            {li.priceSource === "OVERRIDE" && (
                              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 mt-1 text-[10px]">
                                {t("Special pricing")}
                              </Badge>
                            )}
                          </div>
                          <div className="ltr:ml-3 rtl:mr-3 text-right">
                            <div className="font-mono text-stone-900">₹{formatINR(li.unitPrice)}</div>
                            {li.isProRated && (
                              <div className="text-[10px] text-stone-500">
                                {t("of")} ₹{formatINR(li.fullCyclePrice)}/yr
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="border-t border-stone-200 pt-3 space-y-2 text-sm">
                      <div className="flex justify-between text-stone-700">
                        <span>{t("Subtotal")}</span>
                        <span className="font-mono">₹{formatINR(quote.subtotal)}</span>
                      </div>
                      {quote.bundleDiscount && (
                        <div className="flex justify-between text-green-700">
                          <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{quote.bundleDiscount.name}</span>
                          <span className="font-mono">−₹{formatINR(quote.bundleDiscount.amount)}</span>
                        </div>
                      )}
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
                      {t("Future renewals will be at the full annual rate.")}
                    </div>
                  </>
                )}

                {paymentError && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{t("Payment could not be completed")}</p>
                        <p className="text-xs mt-1">{paymentError}</p>
                        {pendingPayment && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={retryPayment}
                            disabled={submitting}
                          >
                            {t("Retry Payment")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full mt-2"
                  disabled={enabledLines.length === 0 || !quote || submitting}
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
      )}
    </div>
  );
}
