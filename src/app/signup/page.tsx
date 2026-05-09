"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { signIn } from "next-auth/react";
import {
  ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Tag, AlertCircle, Eye, EyeOff, CreditCard, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import PaymentModal, { PaymentSuccessData } from "@/components/payment/PaymentModal";
import type { RazorpayOptions, RazorpayResponse, RazorpayInstance, RazorpayFailedResponse } from "@/types/razorpay";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";
type BillingCycle = "MONTHLY" | "YEARLY";

interface PricingRow {
  moduleCode: ModuleCode;
  tier: PlanTier;
  monthlyPrice: number;
  yearlyPrice: number;
  userLimit: number;
  vendorLimit: number | null;
  assessmentLimit: number | null;
  frameworkLimit: number | null;
  auditLimit: number | null;
}

interface BundleDiscountRow {
  name: string;
  minModules: number;
  minTier: PlanTier | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  appliesToCycle: BillingCycle | null;
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
const TIER_RANK: Record<PlanTier, number> = { BASIC: 0, MEDIUM: 1, PRO: 2 };

function formatINR(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// Personal email domains to block (work email required)
const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.in", "yahoo.co.in", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "aol.com",
  "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me",
  "zoho.com",
  "yandex.com", "yandex.ru",
  "mail.com", "email.com",
  "gmx.com", "gmx.net",
  "rediffmail.com", "rediff.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
];

function isWorkEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !PERSONAL_EMAIL_DOMAINS.includes(domain);
}

interface FormState {
  organizationName: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  selections: Array<{ moduleCode: ModuleCode; tier: PlanTier; enabled: boolean }>;
  cycle: BillingCycle;
}

const INITIAL_FORM: FormState = {
  organizationName: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
  selections: ALL_MODULES.map((m) => ({ moduleCode: m, tier: "BASIC", enabled: false })),
  cycle: "YEARLY",
};

const STORAGE_KEY = "verifai_signup_form";

// Pending payment data for retry
interface PendingPayment {
  signupToken: string;
  orderId: string;
  amount: number;
  keyId: string;
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [discounts, setDiscounts] = useState<BundleDiscountRow[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "initiating" | "processing" | "completing" | "failed">("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [formLoaded, setFormLoaded] = useState(false);

  // Store pending payment for retry (use state instead of ref so it triggers re-render)
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const razorpayInstanceRef = useRef<RazorpayInstance | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [shouldOpenModal, setShouldOpenModal] = useState(false);

  // Load form state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Restore step and form data
        if (parsed.step) setStep(parsed.step);
        if (parsed.form) {
          // Merge with initial form to handle any new fields
          setForm({ ...INITIAL_FORM, ...parsed.form });
        }
      }
    } catch {
      // Ignore parse errors
    }
    setFormLoaded(true);
  }, []);

  // Save form state to localStorage whenever it changes
  useEffect(() => {
    if (!formLoaded) return; // Don't save until we've loaded
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, form }));
    } catch {
      // Ignore storage errors
    }
  }, [step, form, formLoaded]);

  // Clear localStorage on successful signup
  const clearSavedForm = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Open modal when pending payment is set and shouldOpenModal is true
  useEffect(() => {
    if (shouldOpenModal && pendingPayment) {
      setShowPaymentModal(true);
      setShouldOpenModal(false);
    }
  }, [shouldOpenModal, pendingPayment]);

  useEffect(() => {
    (async () => {
      try {
        const [p, d] = await Promise.all([
          fetch("/api/public/module-pricing").then((r) => r.json()),
          fetch("/api/public/bundle-discounts").then((r) => r.json()),
        ]);
        setPricing(p.data || []);
        setDiscounts(d.data || []);
      } catch {
        // Silent — fallback prices defined in catalog seeder
      }
    })();
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const getPrice = useCallback((moduleCode: ModuleCode, tier: PlanTier): { monthly: number; yearly: number } => {
    const row = pricing.find((p) => p.moduleCode === moduleCode && p.tier === tier);
    return { monthly: row?.monthlyPrice ?? 0, yearly: row?.yearlyPrice ?? 0 };
  }, [pricing]);

  const enabledLines = useMemo(
    () => form.selections.filter((s) => s.enabled),
    [form.selections]
  );

  const subtotal = useMemo(() => {
    return enabledLines.reduce((sum, s) => {
      const p = getPrice(s.moduleCode, s.tier);
      return sum + (form.cycle === "MONTHLY" ? p.monthly : p.yearly);
    }, 0);
  }, [enabledLines, form.cycle, getPrice]);

  const bestDiscount = useMemo(() => {
    if (enabledLines.length === 0) return null;
    let best: { rule: BundleDiscountRow; amount: number } | null = null;
    for (const rule of discounts) {
      if (rule.appliesToCycle && rule.appliesToCycle !== form.cycle) continue;
      if (enabledLines.length < rule.minModules) continue;
      if (rule.minTier) {
        const minRank = TIER_RANK[rule.minTier];
        if (!enabledLines.every((s) => TIER_RANK[s.tier] >= minRank)) continue;
      }
      const amount = rule.discountType === "PERCENTAGE"
        ? Math.round(subtotal * (rule.discountValue / 100))
        : Math.min(rule.discountValue, subtotal);
      if (!best || amount > best.amount) best = { rule, amount };
    }
    return best;
  }, [discounts, enabledLines, form.cycle, subtotal]);

  const taxableAmount = subtotal - (bestDiscount?.amount ?? 0);
  const taxAmount = Math.round(taxableAmount * 0.18);
  const total = taxableAmount + taxAmount;

  function step1Valid() {
    // Phone validation: at least 10 digits
    const phoneDigits = form.adminPhone.replace(/\D/g, "");
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail);
    return (
      form.organizationName.trim().length >= 2 &&
      form.adminFirstName.trim().length >= 1 &&
      form.adminLastName.trim().length >= 1 &&
      emailValid &&
      isWorkEmail(form.adminEmail) &&
      form.adminPassword.length >= 8 &&
      phoneDigits.length >= 10
    );
  }

  // Check if email looks valid but is personal (for showing hint)
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail);
  const isPersonalEmail = emailLooksValid && !isWorkEmail(form.adminEmail);

  function step2Valid() {
    return enabledLines.length >= 1;
  }

  async function autoLoginAndRedirect(userName: string, password: string) {
    clearSavedForm(); // Clear localStorage on successful signup
    const signed = await signIn("credentials", {
      username: userName,
      password: password,
      redirect: false,
    });
    if (signed?.error) {
      router.push(`/login?username=${encodeURIComponent(userName)}&signedUp=1`);
      return;
    }
    router.push("/settings/subscription?signedUp=1");
  }

  // Handle trial signup (no payment)
  async function submitTrial() {
    setSubmitting(true);
    setError(null);
    setPaymentError(null);
    try {
      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName.trim(),
          adminFirstName: form.adminFirstName.trim(),
          adminLastName: form.adminLastName.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          adminPhone: form.adminPhone.trim(),
          adminPassword: form.adminPassword,
          modules: enabledLines.map((s) => ({ moduleCode: s.moduleCode, tier: s.tier })),
          cycle: form.cycle,
          path: "TRIAL",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Signup failed");

      await autoLoginAndRedirect(json.data.userName, form.adminPassword);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Open custom payment modal with given payment data
  function openPaymentModal(paymentData: PendingPayment) {
    setPendingPayment(paymentData);
    setShouldOpenModal(true); // This will trigger the useEffect to open the modal
  }

  // Handle payment success from modal
  async function handlePaymentSuccess(data: PaymentSuccessData) {
    setShowPaymentModal(false);
    setPaymentStatus("completing");
    setPaymentError(null);

    const signupToken = pendingPayment?.signupToken;
    if (!signupToken) {
      setPaymentError("Session expired. Please try again.");
      setSubmitting(false);
      setPaymentStatus("failed");
      return;
    }

    await completeSignup(
      signupToken,
      data.razorpay_order_id,
      data.razorpay_payment_id,
      data.razorpay_signature
    );
  }

  // Handle payment error from modal
  function handlePaymentError(errorMsg: string) {
    setShowPaymentModal(false);
    setSubmitting(false);
    setPaymentStatus("failed");
    setPaymentError(errorMsg + " Click 'Retry Payment' to try again.");
  }

  // Handle payment modal close
  function handlePaymentModalClose() {
    setShowPaymentModal(false);
    setSubmitting(false);
    setPaymentStatus("failed");
    setPaymentError("Payment was cancelled. Click 'Retry Payment' to try again.");
  }

  // Legacy: Open Razorpay popup checkout (kept as fallback)
  function openRazorpayCheckout(paymentData: PendingPayment) {
    const { signupToken, orderId, amount, keyId } = paymentData;

    const options: RazorpayOptions = {
      key: keyId,
      amount: amount,
      currency: "INR",
      name: "Verifai GRC",
      description: `Subscription - ${enabledLines.map(s => s.moduleCode).join(", ")}`,
      order_id: orderId,
      prefill: {
        name: `${form.adminFirstName} ${form.adminLastName}`.trim(),
        email: form.adminEmail.trim().toLowerCase(),
        contact: form.adminPhone.trim() || undefined,
      },
      notes: {
        organization: form.organizationName.trim(),
        modules: enabledLines.map(s => `${s.moduleCode}:${s.tier}`).join(","),
        cycle: form.cycle,
      },
      theme: {
        color: "#1c1917",
      },
      modal: {
        escape: false,
        confirm_close: true,
        ondismiss: () => {
          setSubmitting(false);
          setPaymentStatus("failed");
          setPaymentError("Payment was cancelled. Click 'Retry Payment' to try again.");
        },
      },
      handler: async (response: RazorpayResponse) => {
        // Payment successful - complete signup
        setPaymentStatus("completing");
        setPaymentError(null);
        await completeSignup(
          signupToken,
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature
        );
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpayInstanceRef.current = razorpay;

    razorpay.on("payment.failed", (response: RazorpayFailedResponse) => {
      console.error("[Razorpay] Payment failed:", response.error);
      setSubmitting(false);
      setPaymentStatus("failed");

      // Provide user-friendly error messages
      let errorMsg = "Payment failed. ";
      switch (response.error.reason) {
        case "payment_failed":
          errorMsg += response.error.description || "Please try again with a different payment method.";
          break;
        case "payment_cancelled":
          errorMsg += "Payment was cancelled. Click 'Retry Payment' to try again.";
          break;
        default:
          errorMsg += response.error.description || "Please try again or contact support.";
      }
      setPaymentError(errorMsg);
    });

    razorpay.open();
  }

  // Handle paid signup with Razorpay
  async function submitPaid() {
    // Prevent double submission
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setPaymentError(null);
    setPaymentStatus("initiating");

    try {
      // Step 1: Initiate payment - create Razorpay order
      const initiateRes = await fetch("/api/public/signup/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName.trim(),
          adminFirstName: form.adminFirstName.trim(),
          adminLastName: form.adminLastName.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          adminPhone: form.adminPhone.trim(),
          adminPassword: form.adminPassword,
          modules: enabledLines.map((s) => ({ moduleCode: s.moduleCode, tier: s.tier })),
          cycle: form.cycle,
        }),
      });

      const initiateJson = await initiateRes.json();

      if (!initiateRes.ok) {
        throw new Error(initiateJson.error || "Failed to initiate payment");
      }

      const { signupToken, orderId, amount, keyId, stubMode, stubPaymentId } = initiateJson.data;

      // Store for retry
      setPendingPayment({ signupToken, orderId, amount, keyId });

      // In stub mode, skip Razorpay checkout and complete directly
      if (stubMode) {
        setPaymentStatus("completing");
        await completeSignup(signupToken, orderId, stubPaymentId || `stub_pay_${Date.now()}`, "stub_signature");
        return;
      }

      // Step 2: Open Razorpay standard checkout (more reliable than custom modal)
      setPaymentStatus("processing");
      openRazorpayCheckout({ signupToken, orderId, amount, keyId });

    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setPaymentStatus("idle");
    }
  }

  // Retry payment with existing order
  function retryPayment() {
    if (!pendingPayment) {
      // No pending payment, start fresh
      submitPaid();
      return;
    }

    setSubmitting(true);
    setPaymentError(null);
    setPaymentStatus("processing");
    openRazorpayCheckout(pendingPayment);
  }

  // Complete signup after payment
  async function completeSignup(
    signupToken: string,
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string
  ) {
    try {
      const completeRes = await fetch("/api/public/signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupToken,
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        }),
      });

      const completeJson = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeJson.error || "Failed to complete signup");
      }

      // Clear pending payment
      setPendingPayment(null);

      // Auto-login and redirect
      await autoLoginAndRedirect(completeJson.data.userName, form.adminPassword);
    } catch (e) {
      setPaymentError((e as Error).message);
      setSubmitting(false);
      setPaymentStatus("failed");
    }
  }

  function getPaymentStatusMessage() {
    switch (paymentStatus) {
      case "initiating":
        return "Preparing payment...";
      case "processing":
        return "Complete payment in the popup...";
      case "completing":
        return "Creating your account...";
      default:
        return "Processing...";
    }
  }

  return (
    <>
      {/* Load Razorpay Checkout Script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
        strategy="afterInteractive"
      />

      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-stone-900">Get started with Verifai GRC</h1>
            <p className="text-stone-600 mt-2">
              Already have an account?{" "}
              <Link href="/login" className="text-stone-900 font-medium hover:underline">Sign in</Link>
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === n ? "bg-stone-900 text-white"
                  : step > n ? "bg-green-600 text-white"
                  : "bg-stone-200 text-stone-500"
                }`}>
                  {step > n ? <Check className="h-4 w-4" /> : n}
                </div>
                {n < 3 && <div className={`h-0.5 w-12 ${step > n ? "bg-green-600" : "bg-stone-200"}`} />}
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="p-6">
              {error && (
                <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 flex gap-2 text-sm text-red-900">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-stone-900">Tell us about your organization</h2>
                  <div>
                    <Label>Organization name *</Label>
                    <Input value={form.organizationName} onChange={(e) => update("organizationName", e.target.value)} placeholder="Acme Pvt Ltd" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First name *</Label>
                      <Input value={form.adminFirstName} onChange={(e) => update("adminFirstName", e.target.value)} />
                    </div>
                    <div>
                      <Label>Last name *</Label>
                      <Input value={form.adminLastName} onChange={(e) => update("adminLastName", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Work email *</Label>
                      <Input
                        type="email"
                        value={form.adminEmail}
                        onChange={(e) => update("adminEmail", e.target.value)}
                        placeholder="you@company.com"
                        className={isPersonalEmail ? "border-red-400 focus-visible:ring-red-400" : ""}
                      />
                      {isPersonalEmail && (
                        <p className="text-xs text-red-600 mt-1">Please use your work email, not a personal one</p>
                      )}
                    </div>
                    <div>
                      <Label>Phone *</Label>
                      <Input type="tel" value={form.adminPhone} onChange={(e) => update("adminPhone", e.target.value)} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div>
                    <Label>Password * <span className="text-xs text-stone-500">(min 8 chars)</span></Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={form.adminPassword}
                        onChange={(e) => update("adminPassword", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute ltr:right-2 rtl:left-2 top-1/2 -translate-y-1/2 text-stone-500"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setStep(2)} disabled={!step1Valid()}>
                      Continue
                      <ArrowRight className="h-4 w-4 ltr:ml-1 rtl:mr-1" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-stone-900">Choose your modules</h2>
                  <p className="text-sm text-stone-600">Select the modules you need for your organization.</p>
                  {form.selections.map((s, idx) => {
                    const meta = MODULE_META[s.moduleCode];
                    return (
                      <div
                        key={s.moduleCode}
                        onClick={() => update("selections", form.selections.map((x, i) => i === idx ? { ...x, enabled: !x.enabled } : x))}
                        className={`border rounded-md p-4 cursor-pointer transition-colors ${s.enabled ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400"}`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={s.enabled}
                            onCheckedChange={(v) => update("selections", form.selections.map((x, i) => i === idx ? { ...x, enabled: !!v } : x))}
                            id={`m-${s.moduleCode}`}
                          />
                          <Label htmlFor={`m-${s.moduleCode}`} className="cursor-pointer flex-1">
                            <span className="text-xl ltr:mr-2 rtl:ml-2">{meta.icon}</span>
                            <span className="font-medium">{meta.label}</span>
                            <span className="text-xs text-stone-600 block">{meta.description}</span>
                          </Label>
                          {s.enabled && <Check className="h-5 w-5 text-green-600" />}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                      Back
                    </Button>
                    <Button onClick={() => setStep(3)} disabled={!step2Valid()}>
                      Continue
                      <ArrowRight className="h-4 w-4 ltr:ml-1 rtl:mr-1" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-stone-900">Almost there — choose how to start</h2>

                  {/* Payment error with retry */}
                  {paymentError && (
                    <div className="rounded-md bg-red-50 border border-red-200 p-4">
                      <div className="flex gap-2 text-sm text-red-900 mb-3">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <div>{paymentError}</div>
                      </div>
                      <Button
                        onClick={retryPayment}
                        disabled={submitting}
                        variant="outline"
                        className="w-full border-red-300 text-red-700 hover:bg-red-100"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry Payment
                      </Button>
                    </div>
                  )}

                  {/* Trial card */}
                  <button
                    onClick={() => !submitting && submitTrial()}
                    disabled={submitting}
                    className="w-full text-left border-2 border-blue-300 bg-blue-50/50 rounded-md p-5 hover:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Sparkles className="h-5 w-5 text-blue-700" />
                      <h3 className="font-semibold text-stone-900">Start 14-day free trial</h3>
                    </div>
                    <p className="text-sm text-stone-700">
                      Full access to your selected modules at <strong>Basic tier</strong>. No payment, no credit card.
                      Subscribe before day 14 to keep going.
                    </p>
                    {submitting && paymentStatus === "idle" && (
                      <div className="mt-3 flex items-center gap-2 text-stone-600 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating your account…
                      </div>
                    )}
                  </button>

                  {/* Subscribe card */}
                  <button
                    onClick={() => !submitting && paymentStatus !== "failed" && submitPaid()}
                    disabled={submitting || paymentStatus === "failed"}
                    className="w-full text-left border-2 border-stone-900 bg-stone-50 rounded-md p-5 hover:bg-stone-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-stone-700" />
                        <h3 className="font-semibold text-stone-900">Subscribe — ₹{formatINR(total)}{form.cycle === "MONTHLY" ? "/mo" : "/yr"}</h3>
                      </div>
                      <Badge>Recommended</Badge>
                    </div>
                    <p className="text-sm text-stone-700">
                      Pay securely with UPI, Cards, Net Banking, or Wallets. Full access at your chosen tiers.
                      Auto-renews so your team never loses access. Cancel anytime.
                    </p>
                    {submitting && paymentStatus !== "idle" && paymentStatus !== "failed" && (
                      <div className="mt-3 flex items-center gap-2 text-stone-600 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {getPaymentStatusMessage()}
                      </div>
                    )}
                  </button>

                  {/* Secure payment note */}
                  <div className="flex items-center justify-center gap-2 text-xs text-stone-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>256-bit SSL encrypted • Powered by Razorpay</span>
                  </div>

                  <div className="flex justify-start pt-2">
                    <Button variant="outline" onClick={() => { setStep(2); setPaymentError(null); setPaymentStatus("idle"); }} disabled={submitting && paymentStatus === "completing"}>
                      <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                      Back
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center mt-6 text-xs text-stone-500">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>

      {/* Custom Payment Modal - Always render, control via isOpen */}
      <PaymentModal
        isOpen={showPaymentModal && !!pendingPayment}
        onClose={handlePaymentModalClose}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        orderId={pendingPayment?.orderId || ""}
        amount={pendingPayment?.amount || 0}
        currency="INR"
        keyId={pendingPayment?.keyId || ""}
        customerName={`${form.adminFirstName} ${form.adminLastName}`.trim()}
        customerEmail={form.adminEmail.trim().toLowerCase()}
        customerPhone={form.adminPhone.trim() || undefined}
        description={`Subscription - ${enabledLines.map(s => s.moduleCode).join(", ")}`}
      />
    </>
  );
}
