"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Home, ChevronRight, ArrowLeft, Tag, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RazorpayOptions, RazorpayResponse, RazorpayInstance } from "@/types/razorpay";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";
type BillingCycle = "MONTHLY" | "YEARLY";

interface CurrentModule {
  moduleCode: ModuleCode;
  tier: PlanTier;
  billingCycle: BillingCycle;
}

interface QuoteLineItem {
  moduleCode: ModuleCode;
  tier: PlanTier;
  description: string;
  unitPrice: number;
  fullCyclePrice: number;
  isProRated: boolean;
  priceSource: "STANDARD" | "OVERRIDE";
}

interface Quote {
  cycle: BillingCycle;
  currency: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  bundleDiscount: { id: string; name: string; amount: number; discountType: string; discountValue: number } | null;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
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

interface Selection {
  moduleCode: ModuleCode;
  tier: PlanTier;
  enabled: boolean;
}

interface PendingPayment {
  invoiceId: string;
  orderId: string;
  amount: number;
  keyId: string;
}

export default function RenewPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFirstSubscribe, setIsFirstSubscribe] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("YEARLY");
  const [selections, setSelections] = useState<Selection[]>([
    { moduleCode: "GRC", tier: "BASIC", enabled: false },
    { moduleCode: "TPRM", tier: "BASIC", enabled: false },
    { moduleCode: "INTERNAL_AUDIT", tier: "BASIC", enabled: false },
  ]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "initiating" | "processing" | "completing" | "failed">("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const razorpayInstanceRef = useRef<RazorpayInstance | null>(null);

  // Initial load — pre-select current modules, or empty when no subscription yet
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/subscription");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Load failed");
        if (cancelled) return;

        if (!json.data) {
          // First-time subscriber: keep the empty defaults, render Subscribe flow
          setIsFirstSubscribe(true);
          return;
        }
        if (json.data.subscriptionType === "COMPLIMENTARY") {
          setError(t("Your subscription is complimentary — no renewal needed."));
          return;
        }
        // Default cycle: pick the cycle of the first module (most customers have one cycle)
        const firstModule: CurrentModule | undefined = json.data.modules[0];
        if (firstModule) setCycle(firstModule.billingCycle);

        // Pre-fill selections based on currently active modules
        setSelections(ALL_MODULES.map((m) => {
          const existing: CurrentModule | undefined = json.data.modules.find(
            (x: CurrentModule) => x.moduleCode === m
          );
          return {
            moduleCode: m,
            tier: existing?.tier ?? "BASIC",
            enabled: !!existing,
          };
        }));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  // Recompute quote whenever selections or cycle change
  const enabledLines = useMemo(
    () => selections.filter((s) => s.enabled).map((s) => ({ moduleCode: s.moduleCode, tier: s.tier })),
    [selections]
  );

  const fetchQuote = useCallback(async () => {
    if (enabledLines.length === 0) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await fetch("/api/settings/subscription/renew/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle, lines: enabledLines }),
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
  }, [cycle, enabledLines, toast, t]);

  useEffect(() => { fetchQuote(); }, [fetchQuote]);

  function updateSelection(idx: number, patch: Partial<Selection>) {
    setSelections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function completeRenewal(
    invoiceId: string,
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ) {
    try {
      const res = await fetch("/api/settings/subscription/renew/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          cycle,
          lines: enabledLines,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to complete renewal");
      }

      setPendingPayment(null);
      toast({
        title: isFirstSubscribe ? t("Subscription activated") : t("Renewal successful"),
        description: t(`Invoice ${json.data.invoiceNumber} generated.`),
      });
      router.push(json.data.redirectUrl || "/settings/subscription");
    } catch (e) {
      setPaymentError((e as Error).message);
      setSubmitting(false);
      setPaymentStatus("failed");
    }
  }

  function openRazorpayCheckout(paymentData: PendingPayment) {
    const { invoiceId, orderId, amount, keyId } = paymentData;

    const options: RazorpayOptions = {
      key: keyId,
      amount: amount,
      currency: "INR",
      name: "Verifai GRC",
      description: `${isFirstSubscribe ? "Subscribe" : "Renew"} — ${enabledLines.map((l) => `${l.moduleCode} ${l.tier}`).join(", ")}`,
      order_id: orderId,
      theme: { color: "#1c1917" },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          setSubmitting(false);
          setPaymentStatus("failed");
          setPaymentError(t("Payment was cancelled. Click 'Retry Payment' to try again."));
        },
      },
      handler: async (response: RazorpayResponse) => {
        setPaymentStatus("completing");
        setPaymentError(null);
        await completeRenewal(
          invoiceId,
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature
        );
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpayInstanceRef.current = razorpay;

    razorpay.on("payment.failed", (response) => {
      setSubmitting(false);
      setPaymentStatus("failed");
      setPaymentError(response.error.description || t("Payment failed. Please try again."));
    });

    razorpay.open();
  }

  async function proceedToPayment() {
    if (!quote || enabledLines.length === 0) return;
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setPaymentError(null);
    setPaymentStatus("initiating");

    try {
      const res = await fetch("/api/settings/subscription/renew/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle, lines: enabledLines }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to initiate payment");
      }

      const { invoiceId, orderId, amount, keyId, stubMode, stubPaymentId } = json.data;
      setPendingPayment({ invoiceId, orderId, amount, keyId });

      // In stub mode, complete directly
      if (stubMode) {
        setPaymentStatus("completing");
        await completeRenewal(invoiceId, orderId, stubPaymentId || `stub_pay_${Date.now()}`, "stub_signature");
        return;
      }

      // Open Razorpay checkout
      setPaymentStatus("processing");
      openRazorpayCheckout({ invoiceId, orderId, amount, keyId });
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setPaymentStatus("idle");
    }
  }

  function retryPayment() {
    if (!pendingPayment) {
      proceedToPayment();
      return;
    }
    setSubmitting(true);
    setPaymentError(null);
    setPaymentStatus("processing");
    openRazorpayCheckout(pendingPayment);
  }

  if (loading) return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRazorpayLoaded(true)} strategy="afterInteractive" />
      <div className="p-8 text-stone-600">{t("Loading…")}</div>
    </>
  );

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

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRazorpayLoaded(true)} strategy="afterInteractive" />
      <div className="space-y-6 p-6 max-w-5xl">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />{t("Home")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/settings/subscription" className="hover:text-stone-900">{t("Subscription & Billing")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{isFirstSubscribe ? t("Subscribe") : t("Renew")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          {isFirstSubscribe ? t("Subscribe to a Plan") : t("Renew Subscription")}
        </h1>
        <p className="mt-1 text-stone-600">
          {isFirstSubscribe
            ? t("Pick the modules you need, the tier, and your billing cycle. Total updates live.")
            : t("Confirm modules, tiers, and billing cycle. Total updates as you change selections.")}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* LEFT: selection */}
        <div className="lg:col-span-2 space-y-5">
          {/* Cycle toggle */}
          <Card>
            <CardHeader className="border-b border-stone-200 py-3">
              <CardTitle className="text-base">{t("Billing Cycle")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCycle(c)}
                    className={`p-4 rounded-md border-2 text-left transition-colors ${
                      cycle === c
                        ? "border-stone-900 bg-stone-50"
                        : "border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    <div className="font-medium text-stone-900">
                      {c === "MONTHLY" ? t("Monthly") : t("Yearly")}
                    </div>
                    {c === "YEARLY" && (
                      <div className="text-xs text-green-700 mt-1">{t("Save 2 months free")}</div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Module selection */}
          <Card>
            <CardHeader className="border-b border-stone-200 py-3">
              <CardTitle className="text-base">{t("Modules")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {selections.map((s, idx) => {
                const meta = MODULE_META[s.moduleCode];
                return (
                  <div
                    key={s.moduleCode}
                    className={`p-4 ${idx > 0 ? "border-t border-stone-100" : ""} flex items-center gap-3`}
                  >
                    <Checkbox
                      checked={s.enabled}
                      onCheckedChange={(v) => updateSelection(idx, { enabled: !!v })}
                      id={`mod-${s.moduleCode}`}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`mod-${s.moduleCode}`} className="flex items-center gap-2 cursor-pointer">
                        <span className="text-xl">{meta.icon}</span>
                        <span className="font-medium">{meta.label}</span>
                      </Label>
                      <p className="text-xs text-stone-600 mt-0.5">{t(meta.description)}</p>
                    </div>
                    {/* Tier selector inline */}
                    <div className={`flex gap-1 ${s.enabled ? "" : "opacity-30 pointer-events-none"}`}>
                      {(["BASIC", "MEDIUM", "PRO"] as PlanTier[]).map((tier) => (
                        <button
                          key={tier}
                          onClick={() => updateSelection(idx, { tier })}
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
                  {t("Select at least one module to see a quote.")}
                </div>
              ) : !quote ? (
                <div className="text-sm text-stone-500 py-4">{t("Loading quote…")}</div>
              ) : (
                <>
                  {quote.lineItems.map((li) => (
                    <div key={`${li.moduleCode}-${li.tier}`} className="flex items-start justify-between text-sm">
                      <div className="flex-1">
                        <div className="text-stone-900">{li.description}</div>
                        {li.priceSource === "OVERRIDE" && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 mt-1 text-[10px]">
                            {t("Special pricing")}
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-stone-900 ltr:ml-3 rtl:mr-3">₹{formatINR(li.unitPrice)}</span>
                    </div>
                  ))}

                  <div className="border-t border-stone-200 pt-3 space-y-2 text-sm">
                    <div className="flex justify-between text-stone-700">
                      <span>{t("Subtotal")}</span>
                      <span className="font-mono">₹{formatINR(quote.subtotal)}</span>
                    </div>
                    {quote.bundleDiscount && (
                      <div className="flex justify-between text-green-700">
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {quote.bundleDiscount.name}
                        </span>
                        <span className="font-mono">−₹{formatINR(quote.bundleDiscount.amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-stone-700">
                      <span>{t("GST")} ({quote.taxRate}%)</span>
                      <span className="font-mono">₹{formatINR(quote.taxAmount)}</span>
                    </div>
                  </div>

                  <div className="border-t border-stone-200 pt-3 flex justify-between items-baseline">
                    <span className="font-semibold text-stone-900">{t("Total")}</span>
                    <span className="font-mono font-semibold text-xl text-stone-900">
                      ₹{formatINR(quote.total)}
                    </span>
                  </div>

                  <div className="text-xs text-stone-500">
                    {quote.cycle === "MONTHLY" ? t("Billed monthly") : t("Billed yearly")}
                  </div>
                </>
              )}

              {/* Payment error with retry */}
              {paymentError && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 mb-2">
                  <div className="flex gap-2 text-sm text-red-900 mb-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>{paymentError}</div>
                  </div>
                  <Button
                    onClick={retryPayment}
                    disabled={submitting}
                    variant="outline"
                    size="sm"
                    className="w-full border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("Retry Payment")}
                  </Button>
                </div>
              )}

              <Button
                className="w-full mt-2"
                disabled={enabledLines.length === 0 || !quote || submitting || paymentStatus === "failed"}
                onClick={proceedToPayment}
              >
                {submitting && paymentStatus !== "failed" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {paymentStatus === "initiating" ? t("Preparing payment…") :
                     paymentStatus === "processing" ? t("Complete payment in popup…") :
                     paymentStatus === "completing" ? t("Finalizing…") :
                     t("Processing…")}
                  </>
                ) : t("Proceed to Payment")}
              </Button>

              <Link href="/settings/subscription" className="block text-center text-sm text-stone-600 hover:text-stone-900">
                {t("Cancel")}
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </>
  );
}
