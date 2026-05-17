"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import Script from "next/script";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Building2,
  ClipboardCheck,
  Database,
  AlertCircle,
  CreditCard,
  Calendar,
  Zap,
  PartyPopper,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";
type BillingCycle = "MONTHLY" | "YEARLY";

interface PlanRow {
  moduleCode: ModuleCode;
  planType: "BASE" | "GENERAL";
  monthlyPrice: number | null;
  yearlyPrice: number;
  userLimit: number;
  unlimitedUsers: boolean;
}

interface RazorpayResponse {
  razorpay_payment_id?: string;
  razorpay_subscription_id: string;
  razorpay_signature?: string;
}

interface RazorpayError {
  error: {
    code?: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
  };
}

const MODULE_META: Record<
  ModuleCode,
  { label: string; icon: React.ReactNode; description: string }
> = {
  GRC: {
    label: "GRC",
    icon: <Shield className="h-5 w-5" />,
    description: "Governance, Risk & Compliance",
  },
  TPRM: {
    label: "TPRM",
    icon: <Building2 className="h-5 w-5" />,
    description: "Third-Party Risk Management",
  },
  INTERNAL_AUDIT: {
    label: "Internal Audit",
    icon: <ClipboardCheck className="h-5 w-5" />,
    description: "Audit planning, fieldwork & reporting",
  },
  TECHNICAL_EVIDENCE: {
    label: "Technical Evidence",
    icon: <Database className="h-5 w-5" />,
    description: "Automated control evidence collection",
  },
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

// Personal email domains to block (work email required)
const PERSONAL_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.in",
  "yahoo.co.in",
  "yahoo.co.uk",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "email.com",
  "gmx.com",
  "gmx.net",
  "rediffmail.com",
  "rediff.com",
  "inbox.com",
  "fastmail.com",
  "tutanota.com",
];

function isWorkEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !PERSONAL_EMAIL_DOMAINS.includes(domain);
}

// LocalStorage key for form persistence
const SIGNUP_STORAGE_KEY = "verifai_signup_v2_form";

// SavedFormState interface removed in Phase 11 — signup is no longer persisted.
// The SIGNUP_STORAGE_KEY constant above is retained only for the on-mount
// cleanup that wipes any stale data from the previous persistence model.

export default function SignupV2Page() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [formLoaded, setFormLoaded] = useState(false);
  // Phase 11: success dialog shown after a confirmed payment + auto-login.
  // Clicking the button routes through the root page.tsx which handles the
  // multi-module-aware destination (single-module home OR /select-module picker).
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Step 1: details
  const [organizationName, setOrganizationName] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: plan choices
  const [selectedModules, setSelectedModules] = useState<Set<ModuleCode>>(
    new Set(["GRC"])
  );
  // Year 2 is always yearly billing (mandatory 2-year contract)
  const generalBillingCycle: BillingCycle = "YEARLY";

  // Step 3: consent
  const [contractAccepted, setContractAccepted] = useState(false);
  const [autopayAccepted, setAutopayAccepted] = useState(false);

  // Public catalog
  const [pricing, setPricing] = useState<PlanRow[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);

  // Phase 11: signup page never pre-fills from prior attempts. Every visit is
  // a fresh form. Defensive cleanup on mount wipes any data left over from the
  // previous localStorage persistence model (which auto-restored fields and
  // caused stale data + step-jumping bugs).
  useEffect(() => {
    try {
      localStorage.removeItem(SIGNUP_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setFormLoaded(true);
  }, []);

  // No save effect — we intentionally do not persist form state.

  // No-op kept for compatibility with success/error paths that still call it.
  // Safe to remove later once those callers are audited.
  const clearSavedForm = useCallback(() => {
    try {
      localStorage.removeItem(SIGNUP_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

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

  // Email validation helpers
  const emailLooksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail);
  const isPersonalEmail = emailLooksValid && !isWorkEmail(adminEmail);

  function step1Valid(): boolean {
    return (
      organizationName.length >= 2 &&
      adminFirstName.length >= 1 &&
      adminLastName.length >= 1 &&
      emailLooksValid &&
      isWorkEmail(adminEmail) &&
      adminPassword.length >= 8
    );
  }

  function step2Valid(): boolean {
    return selectedModules.size >= 1;
  }

  function step3Valid(): boolean {
    return contractAccepted && autopayAccepted;
  }

  // Handle Razorpay checkout completion
  const handlePaymentSuccess = useCallback(
    async (response: RazorpayResponse) => {
      try {
        // Verify the subscription was authorized
        const verifyRes = await fetch("/api/public/signup/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        if (!verifyRes.ok) {
          const err = await verifyRes.json();
          throw new Error(err.error || "Payment verification failed");
        }

        // Clear saved form data after successful signup
        clearSavedForm();

        // Auto-login
        const result = await signIn("credentials", {
          username: adminEmail,
          password: adminPassword,
          redirect: false,
        });

        if (result?.error) {
          setError(
            t("Account created but auto-login failed. Please log in manually.")
          );
          router.push("/login?signup=success");
          return;
        }

        setSubmitting(false);
        setShowSuccessModal(true);
      } catch (e) {
        setError((e as Error).message);
        setSubmitting(false);
      }
    },
    [adminEmail, adminPassword, router, t, clearSavedForm]
  );

  const handlePaymentError = useCallback(
    (error: RazorpayError) => {
      console.error("Payment failed:", error);
      setError(
        error.error?.description ||
          t("Payment failed. Please try again.")
      );
      setSubmitting(false);
    },
    [t]
  );

  async function initiatePayment() {
    setError(null);
    setSubmitting(true);

    try {
      // Create the subscription and get checkout details
      const res = await fetch("/api/public/signup/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          adminFirstName,
          adminLastName,
          adminEmail,
          adminPassword,
          modules: Array.from(selectedModules).map((c) => ({ moduleCode: c })),
          generalBillingCycle,
          contractAccepted: true,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Signup failed");

      // Stub mode: auto-login immediately
      if (json.data.stub) {
        clearSavedForm(); // Clear saved form data
        const result = await signIn("credentials", {
          username: adminEmail,
          password: adminPassword,
          redirect: false,
        });
        if (result?.error) {
          setError(
            t("Account created but auto-login failed. Please log in manually.")
          );
          router.push("/login");
          return;
        }
        setSubmitting(false);
        setShowSuccessModal(true);
        return;
      }

      // Real mode: Open Razorpay checkout
      if (!json.data.mandate?.subscriptionId || !json.data.razorpayKeyId) {
        // If checkoutUrl is provided, redirect to it
        if (json.data.mandate?.checkoutUrl) {
          clearSavedForm(); // Clear before redirect
          window.location.href = json.data.mandate.checkoutUrl;
          return;
        }
        throw new Error("Payment initialization failed");
      }

      // Open inline Razorpay checkout
      const options = {
        key: json.data.razorpayKeyId,
        subscription_id: json.data.mandate.subscriptionId,
        name: "Verifai GRC",
        description: `${selectedModules.size} module(s) - 2 Year Subscription`,
        prefill: {
          name: `${adminFirstName} ${adminLastName}`,
          email: adminEmail,
        },
        theme: {
          color: "#1c1917",
        },
        handler: handlePaymentSuccess,
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setError(t("Payment was cancelled. Please try again."));
          },
          escape: false,
          confirm_close: true,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", handlePaymentError);
      rzp.open();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  // Compute breakdown for selected modules
  const selectedBaseRows = pricing.filter(
    (p) => p.planType === "BASE" && selectedModules.has(p.moduleCode)
  );
  const selectedGeneralRows = pricing.filter(
    (p) => p.planType === "GENERAL" && selectedModules.has(p.moduleCode)
  );

  // Year 1 pricing (BASE plan) - from database
  const year1MonthlyPerModule = selectedBaseRows.length > 0
    ? Math.round(selectedBaseRows[0].yearlyPrice / 12)
    : 100; // Default ₹100/month if no data
  const year1Yearly = selectedBaseRows.reduce((s, r) => s + r.yearlyPrice, 0);
  const year1YearlyWithGst = Math.round(year1Yearly * 1.18);

  // Year 2 pricing (GENERAL plan) - monthly billing after Year 1
  const year2MonthlyTotal = selectedGeneralRows.reduce(
    (s, r) => s + (r.monthlyPrice ?? Math.round(r.yearlyPrice / 12)),
    0
  );
  const year2MonthlyWithGst = Math.round(year2MonthlyTotal * 1.18);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
      />

      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-semibold text-stone-900">
              {t("Subscribe to Verifai GRC")}
            </h1>
            <p className="text-stone-600 mt-2">
              {t("2-year subscription with autopay")}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <StepDot
              active={step >= 1}
              done={step > 1}
              num={1}
              label={t("Details")}
            />
            <div className="h-px w-8 bg-stone-300" />
            <StepDot
              active={step >= 2}
              done={step > 2}
              num={2}
              label={t("Plan")}
            />
            <div className="h-px w-8 bg-stone-300" />
            <StepDot
              active={step >= 3}
              done={false}
              num={3}
              label={t("Payment")}
            />
          </div>

          <Card>
            <CardContent className="p-6">
              {error && (
                <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1: Details */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="org">{t("Organization name")} *</Label>
                    <Input
                      id="org"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="fn">{t("First name")} *</Label>
                      <Input
                        id="fn"
                        value={adminFirstName}
                        onChange={(e) => setAdminFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ln">{t("Last name")} *</Label>
                      <Input
                        id="ln"
                        value={adminLastName}
                        onChange={(e) => setAdminLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="em">{t("Work email")} *</Label>
                    <Input
                      id="em"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className={
                        isPersonalEmail
                          ? "border-red-400 focus-visible:ring-red-400"
                          : ""
                      }
                    />
                    {isPersonalEmail && (
                      <p className="text-xs text-red-600 mt-1">
                        {t("Please use your work email, not a personal one")}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="pw">
                      {t("Password")} *{" "}
                      <span className="text-stone-500 text-xs">
                        {t("(8+ characters)")}
                      </span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="pw"
                        type={showPassword ? "text" : "password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <Link
                      href="/login"
                      className="text-sm text-stone-600 hover:text-stone-900"
                    >
                      {t("Already have an account? Log in")}
                    </Link>
                    <Button onClick={() => setStep(2)} disabled={!step1Valid()}>
                      {t("Next")}{" "}
                      <ArrowRight className="h-4 w-4 ltr:ml-2 rtl:mr-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Plan Selection */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <Label className="text-base font-medium">
                      {t("Select modules")}
                    </Label>
                    <p className="text-xs text-stone-600 mb-3">
                      {t("Choose one or more modules for your subscription.")}
                    </p>
                    <div className="space-y-2">
                      {(Object.keys(MODULE_META) as ModuleCode[]).map((code) => (
                        <label
                          key={code}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                            selectedModules.has(code)
                              ? "border-stone-900 bg-stone-50"
                              : "border-stone-200 hover:bg-stone-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedModules.has(code)}
                            onChange={() => toggleModule(code)}
                            className="h-4 w-4"
                          />
                          <div className="text-stone-700">
                            {MODULE_META[code].icon}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {MODULE_META[code].label}
                            </div>
                            <div className="text-xs text-stone-600">
                              {t(MODULE_META[code].description)}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{" "}
                      {t("Back")}
                    </Button>
                    <Button onClick={() => setStep(3)} disabled={!step2Valid()}>
                      {t("Next")}{" "}
                      <ArrowRight className="h-4 w-4 ltr:ml-2 rtl:mr-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Payment */}
              {step === 3 && (
                <div className="space-y-5">
                  {/* Pricing Breakdown */}
                  <div className="rounded-lg border border-stone-200 overflow-hidden">
                    <div className="bg-stone-100 px-4 py-3 border-b border-stone-200">
                      <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {t("2-Year Subscription Plan")}
                      </h3>
                      <p className="text-xs text-stone-600 mt-1">
                        {selectedModules.size} {t("module")}
                        {selectedModules.size > 1 ? "s" : ""} {t("selected")}
                      </p>
                    </div>

                    {loadingPricing ? (
                      <div className="p-4 text-center text-stone-600">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        {t("Loading...")}
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-200">
                        {/* Year 1 - Module-wise breakdown */}
                        <div className="p-4 bg-emerald-50">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap className="h-4 w-4 text-emerald-700" />
                            <span className="font-medium text-emerald-900">
                              {t("Year 1")} - {t("Promotional Rate")}
                            </span>
                            <span className="ml-auto text-xs text-emerald-800 bg-emerald-100 rounded px-2 py-1">
                              {t("Charged after 14-day trial")}
                            </span>
                          </div>

                          {/* Module-wise breakdown */}
                          <div className="space-y-2 mb-3">
                            {selectedBaseRows.map((row) => (
                              <div key={row.moduleCode} className="flex items-center justify-between text-sm bg-white/60 rounded px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="text-emerald-700">
                                    {MODULE_META[row.moduleCode]?.icon}
                                  </div>
                                  <span className="text-emerald-900">{MODULE_META[row.moduleCode]?.label || row.moduleCode}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono text-emerald-900">₹{formatINR(row.yearlyPrice)}/{t("yr")}</span>
                                  <span className="text-xs text-emerald-700 ml-1">
                                    (₹{formatINR(Math.round(row.yearlyPrice / 12))}/{t("mo")})
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Year 1 Total */}
                          <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                            <span className="text-sm font-medium text-emerald-900">{t("Year 1 Total")}</span>
                            <div className="text-right">
                              <div className="font-mono font-semibold text-emerald-900">
                                ₹{formatINR(year1Yearly)}
                              </div>
                              <div className="text-xs text-emerald-700">
                                + 18% GST = ₹{formatINR(year1YearlyWithGst)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Year 2 - Module-wise breakdown */}
                        <div className="p-4 bg-stone-50">
                          <div className="flex items-center gap-2 mb-3">
                            <Calendar className="h-4 w-4 text-stone-700" />
                            <span className="font-medium text-stone-900">
                              {t("Year 2")} - {t("Standard Rate")}
                            </span>
                            <span className="ml-auto text-xs text-stone-600 bg-stone-200 rounded px-2 py-1">
                              {t("Monthly billing")}
                            </span>
                          </div>

                          {/* Module-wise breakdown */}
                          <div className="space-y-2 mb-3">
                            {selectedGeneralRows.map((row) => (
                              <div key={row.moduleCode} className="flex items-center justify-between text-sm bg-white/60 rounded px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="text-stone-600">
                                    {MODULE_META[row.moduleCode]?.icon}
                                  </div>
                                  <span className="text-stone-900">{MODULE_META[row.moduleCode]?.label || row.moduleCode}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono text-stone-900">₹{formatINR(row.monthlyPrice ?? Math.round(row.yearlyPrice / 12))}/{t("mo")}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Year 2 Total */}
                          <div className="flex items-center justify-between pt-2 border-t border-stone-300">
                            <span className="text-sm font-medium text-stone-900">{t("Year 2 Monthly")}</span>
                            <div className="text-right">
                              <div className="font-mono font-semibold text-stone-900">
                                ₹{formatINR(selectedGeneralRows.reduce((s, r) => s + (r.monthlyPrice ?? Math.round(r.yearlyPrice / 12)), 0))}/{t("mo")}
                              </div>
                              <div className="text-xs text-stone-600">
                                + 18% GST = ₹{formatINR(Math.round(selectedGeneralRows.reduce((s, r) => s + (r.monthlyPrice ?? Math.round(r.yearlyPrice / 12)), 0) * 1.18))}/{t("mo")}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Verification & Payment Info */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900">
                          {t("Payment Schedule")}
                        </h4>

                        <div className="mt-3 space-y-3">
                          {/* Today - Verification */}
                          <div className="flex items-center gap-3 p-2 bg-white/60 rounded-md border border-blue-200">
                            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              ₹5
                            </div>
                            <div>
                              <div className="text-sm font-medium text-blue-900">{t("Today")}</div>
                              <div className="text-xs text-blue-700">{t("Card verification only")}</div>
                            </div>
                          </div>

                          {/* After 14 days - Year 1 charge */}
                          <div className="flex items-center gap-3 p-2 bg-white/60 rounded-md border border-blue-200">
                            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              14d
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-blue-900">{t("After 14-day trial")}</div>
                              <div className="text-xs text-blue-700">{t("Year 1 subscription charged")}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-blue-900">₹{formatINR(year1YearlyWithGst)}</div>
                              <div className="text-[10px] text-blue-600">{t("incl. GST")}</div>
                            </div>
                          </div>

                          {/* After Year 1 - Monthly billing */}
                          <div className="flex items-center gap-3 p-2 bg-white/60 rounded-md border border-blue-200">
                            <div className="h-8 w-8 rounded-full bg-stone-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              Y2+
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-blue-900">{t("After Year 1")}</div>
                              <div className="text-xs text-blue-700">{t("Monthly billing starts")}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-blue-900">₹{formatINR(year2MonthlyWithGst)}/{t("mo")}</div>
                              <div className="text-[10px] text-blue-600">{t("incl. GST")}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contract Terms */}
                  <div className="space-y-3">
                    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={contractAccepted}
                          onCheckedChange={(v) => {
                            const checked = Boolean(v);
                            setContractAccepted(checked);
                            // Auto-check autopay when contract is accepted (required for 2-year commitment)
                            if (checked) {
                              setAutopayAccepted(true);
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="text-sm text-stone-800">
                          <div className="font-medium mb-1">
                            {t("I agree to the 2-year subscription commitment")}
                          </div>
                          <p className="text-xs text-stone-700">
                            {t("I understand this is a mandatory 2-year contract. Cancellation is not available during the contract period.")}
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className={`rounded-lg border-2 p-4 ${contractAccepted ? "border-stone-300 bg-stone-100" : "border-stone-200 bg-stone-50"}`}>
                      <label className={`flex items-start gap-3 ${contractAccepted ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <Checkbox
                          checked={autopayAccepted}
                          onCheckedChange={(v) => setAutopayAccepted(Boolean(v))}
                          disabled={contractAccepted}
                          className="mt-0.5"
                        />
                        <div className="text-sm text-stone-800">
                          <div className="font-medium mb-1">
                            {t("I authorize automatic payments")}
                          </div>
                          <p className="text-xs text-stone-700">
                            {t("I authorize recurring charges to my payment method. If payment fails or autopay is disabled, my subscription will end immediately.")}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setStep(2)}
                      disabled={submitting}
                    >
                      <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" />{" "}
                      {t("Back")}
                    </Button>
                    <Button
                      onClick={initiatePayment}
                      disabled={!step3Valid() || submitting || !razorpayLoaded}
                      className="min-w-[180px] bg-emerald-600 hover:bg-emerald-700"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                          {t("Processing...")}
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                          {t("Start 14-Day Trial")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Phase 11 — Post-payment success modal. Replaces the previous
          hard-coded redirect to /dashboard (which broke for TPRM/IA/TE-only
          customers because they don't have GRC subscription, so the layout
          gate bounced them to /subscription-required).
          Now: button click pushes to "/", which uses the canonical root-page
          routing logic (single-module home, or /select-module picker). */}
      <Dialog
        open={showSuccessModal}
        // Block accidental dismiss by clicking outside / pressing Escape —
        // the only way out is the primary button below, which guarantees
        // the user lands on a valid page.
        onOpenChange={(open) => {
          if (!open) return;
          setShowSuccessModal(open);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-md text-center"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-100 rounded-full blur-xl opacity-60" />
              <div className="relative bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-full p-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold text-stone-900 flex items-center justify-center gap-2">
                <PartyPopper className="h-6 w-6 text-amber-500" />
                {t("Welcome to Verifai!")}
              </DialogTitle>
              <DialogDescription className="text-sm text-stone-600 max-w-sm">
                {t("Your subscription is active and your account is ready. Click below to get started.")}
              </DialogDescription>
            </div>
            <Button
              size="lg"
              className="w-full mt-2"
              onClick={() => router.push("/")}
            >
              {t("Get Started")}
              <ArrowRight className="h-4 w-4 ltr:ml-2 rtl:mr-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StepDot({
  active,
  done,
  num,
  label,
}: {
  active: boolean;
  done: boolean;
  num: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
          done
            ? "bg-emerald-600 text-white"
            : active
              ? "bg-stone-900 text-white"
              : "bg-stone-200 text-stone-500"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : num}
      </div>
      <span
        className={`text-xs ${active ? "text-stone-900 font-medium" : "text-stone-500"}`}
      >
        {label}
      </span>
    </div>
  );
}
