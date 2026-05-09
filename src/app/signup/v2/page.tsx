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
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Building2,
  ClipboardCheck,
  AlertCircle,
  CreditCard,
  Calendar,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
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

interface SavedFormState {
  step: 1 | 2 | 3;
  organizationName: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  // Note: password is NOT saved for security
  selectedModules: ModuleCode[];
  contractAccepted: boolean;
  autopayAccepted: boolean;
}

export default function SignupV2Page() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [formLoaded, setFormLoaded] = useState(false);

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

  // Load saved form state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIGNUP_STORAGE_KEY);
      if (saved) {
        const data: SavedFormState = JSON.parse(saved);
        if (data.step) setStep(data.step);
        if (data.organizationName) setOrganizationName(data.organizationName);
        if (data.adminFirstName) setAdminFirstName(data.adminFirstName);
        if (data.adminLastName) setAdminLastName(data.adminLastName);
        if (data.adminEmail) setAdminEmail(data.adminEmail);
        if (data.selectedModules?.length) {
          setSelectedModules(new Set(data.selectedModules));
        }
        if (data.contractAccepted) setContractAccepted(data.contractAccepted);
        if (data.autopayAccepted) setAutopayAccepted(data.autopayAccepted);
      }
    } catch {
      // Ignore parse errors
    }
    setFormLoaded(true);
  }, []);

  // Save form state to localStorage on changes (except password)
  useEffect(() => {
    if (!formLoaded) return; // Don't save until we've loaded
    try {
      const data: SavedFormState = {
        step,
        organizationName,
        adminFirstName,
        adminLastName,
        adminEmail,
        selectedModules: Array.from(selectedModules),
        contractAccepted,
        autopayAccepted,
      };
      localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }, [formLoaded, step, organizationName, adminFirstName, adminLastName, adminEmail, selectedModules, contractAccepted, autopayAccepted]);

  // Clear saved form after successful signup
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

        router.push("/dashboard");
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
        router.push("/dashboard");
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

  // Year 2 pricing (GENERAL plan) - from database, always yearly
  const year2MonthlyPerModule = selectedGeneralRows.length > 0
    ? (selectedGeneralRows[0].monthlyPrice ?? Math.round(selectedGeneralRows[0].yearlyPrice / 12))
    : 15000; // Default ₹15,000/month if no data
  const year2Yearly = selectedGeneralRows.reduce((s, r) => s + r.yearlyPrice, 0);
  const year2YearlyWithGst = Math.round(year2Yearly * 1.18);

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
                        {/* Year 1 */}
                        <div className="p-4 bg-emerald-50">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-emerald-900 flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                {t("Year 1")} - {t("Promotional Rate")}
                              </div>
                              <p className="text-sm text-emerald-700 mt-1">
                                ₹{formatINR(year1MonthlyPerModule)}/{t("module")}/{t("month")}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-semibold text-emerald-900">
                                ₹{formatINR(year1Yearly)}/{t("yr")}
                              </div>
                              <div className="text-xs text-emerald-700">
                                + 18% GST = ₹{formatINR(year1YearlyWithGst)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-emerald-800 bg-emerald-100 rounded px-2 py-1 inline-block">
                            {t("Charged after 14-day trial period")}
                          </div>
                        </div>

                        {/* Year 2 */}
                        <div className="p-4 bg-stone-50">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium text-stone-900 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {t("Year 2")} - {t("Standard Rate")}
                              </div>
                              <p className="text-sm text-stone-600 mt-1">
                                ₹{formatINR(year2MonthlyPerModule)}/{t("module")}/{t("month")}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-semibold text-stone-900">
                                ₹{formatINR(year2Yearly)}/{t("yr")}
                              </div>
                              <div className="text-xs text-stone-600">
                                + 18% GST = ₹{formatINR(year2YearlyWithGst)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-stone-700">
                            {t("Billed annually starting Year 2")}
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
                              ₹2
                            </div>
                            <div>
                              <div className="text-sm font-medium text-blue-900">{t("Today")}</div>
                              <div className="text-xs text-blue-700">{t("Card verification only")}</div>
                            </div>
                          </div>

                          {/* After 14 days - Full 2-year charge */}
                          <div className="flex items-center gap-3 p-2 bg-white/60 rounded-md border border-blue-200">
                            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              14d
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-blue-900">{t("After 14-day trial")}</div>
                              <div className="text-xs text-blue-700">{t("Full 2-year subscription charged")}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-blue-900">₹{formatINR(year1YearlyWithGst + year2YearlyWithGst)}</div>
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
                          onCheckedChange={(v) => setContractAccepted(Boolean(v))}
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

                    <div className="rounded-lg border-2 border-stone-200 bg-stone-50 p-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={autopayAccepted}
                          onCheckedChange={(v) => setAutopayAccepted(Boolean(v))}
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
