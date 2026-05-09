"use client";

/**
 * Public V2 signup wizard.
 *   Step 1 — Org + admin user details
 *   Step 2 — Module selection + General billing cycle + 2-year contract consent
 *
 * Submits to POST /api/public/signup/v2 which creates the customer, admin
 * user, V2 Subscription envelope, ModuleSubscriptions on BASE, and a Razorpay
 * mandate (or stub). On success, auto-logs the new admin in and redirects
 * to /dashboard.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Eye, EyeOff,
  Shield, Building2, ClipboardCheck, Sparkles, AlertCircle,
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

const MODULE_META: Record<ModuleCode, { label: string; icon: React.ReactNode; description: string }> = {
  GRC:            { label: "GRC",            icon: <Shield className="h-5 w-5" />,         description: "Governance, Risk & Compliance" },
  TPRM:           { label: "TPRM",           icon: <Building2 className="h-5 w-5" />,      description: "Third-Party Risk Management" },
  INTERNAL_AUDIT: { label: "Internal Audit", icon: <ClipboardCheck className="h-5 w-5" />, description: "Audit planning, fieldwork & reporting" },
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: details
  const [organizationName, setOrganizationName] = useState("");
  const [gstin, setGstin] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: plan choices
  const [selectedModules, setSelectedModules] = useState<Set<ModuleCode>>(new Set(["GRC"]));
  const [generalBillingCycle, setGeneralBillingCycle] = useState<BillingCycle>("YEARLY");
  const [contractAccepted, setContractAccepted] = useState(false);

  // Public catalog
  const [pricing, setPricing] = useState<PlanRow[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(true);

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

  function step1Valid(): boolean {
    return (
      organizationName.length >= 2 &&
      adminFirstName.length >= 1 &&
      adminLastName.length >= 1 &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail) &&
      adminPassword.length >= 8
    );
  }

  function step2Valid(): boolean {
    return selectedModules.size >= 1 && contractAccepted;
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/signup/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName,
          gstin: gstin || null,
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

      // Auto-login
      const result = await signIn("credentials", {
        userName: adminEmail,
        password: adminPassword,
        redirect: false,
      });
      if (result?.error) {
        setError(t("Account created but auto-login failed. Please log in manually."));
        router.push("/login");
        return;
      }
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Compute breakdown for selected modules
  const selectedBaseRows = pricing.filter((p) => p.planType === "BASE" && selectedModules.has(p.moduleCode));
  const selectedGeneralRows = pricing.filter((p) => p.planType === "GENERAL" && selectedModules.has(p.moduleCode));
  const baseSubtotal = selectedBaseRows.reduce((s, r) => s + r.yearlyPrice, 0);
  const generalSubtotalMonthly = selectedGeneralRows.reduce((s, r) => s + (r.monthlyPrice ?? 0), 0);
  const generalSubtotalYearly = selectedGeneralRows.reduce((s, r) => s + r.yearlyPrice, 0);
  const baseTotalWithGst = Math.round(baseSubtotal * 1.18);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-stone-900">{t("Get Started with Verifai GRC")}</h1>
          <p className="text-stone-600 mt-2">{t("Year 1 promotional plan, then standard pricing — 2-year commitment")}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <StepDot active={step >= 1} done={step > 1} label={t("Details")} />
          <div className="h-px w-12 bg-stone-300" />
          <StepDot active={step >= 2} done={false} label={t("Plan & Consent")} />
        </div>

        <Card>
          <CardContent className="p-6">
            {error && (
              <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="org">{t("Organization name")} *</Label>
                  <Input id="org" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="gstin">{t("GSTIN")} ({t("optional")})</Label>
                  <Input id="gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} maxLength={15} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="fn">{t("First name")} *</Label>
                    <Input id="fn" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ln">{t("Last name")} *</Label>
                    <Input id="ln" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="em">{t("Work email")} *</Label>
                  <Input id="em" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pw">{t("Password")} * <span className="text-stone-500 text-xs">{t("(8+ characters)")}</span></Label>
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
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900">
                    {t("Already have an account? Log in")}
                  </Link>
                  <Button onClick={() => setStep(2)} disabled={!step1Valid()}>
                    {t("Next")} <ArrowRight className="h-4 w-4 ltr:ml-2 rtl:mr-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-base font-medium">{t("Select modules")}</Label>
                  <p className="text-xs text-stone-600 mb-3">{t("Choose one or more modules. Each gets its own 2-year contract.")}</p>
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

                <div>
                  <Label className="text-base font-medium">{t("Year-2+ billing cycle")}</Label>
                  <p className="text-xs text-stone-600 mb-2">{t("After Year 1 (Base plan), the General plan auto-starts on this cycle")}</p>
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

                {/* Breakdown */}
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

                {/* Contract consent */}
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
                        {t("I understand each module has a 2-year minimum commitment starting today. After the Year-1 Base plan ends, the General plan will auto-start and recurring charges will be auto-debited from my saved payment method. Cancellation is not available before the 2-year contract end.")}
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                    <ArrowLeft className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Back")}
                  </Button>
                  <Button onClick={submit} disabled={!step2Valid() || submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin ltr:mr-2 rtl:ml-2" />
                        {t("Creating account…")}
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 ltr:mr-2 rtl:ml-2" /> {t("Create account")}
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
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
          done ? "bg-emerald-600 text-white" : active ? "bg-stone-900 text-white" : "bg-stone-200 text-stone-500"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : active ? "•" : ""}
      </div>
      <span className={`text-xs ${active ? "text-stone-900 font-medium" : "text-stone-500"}`}>{label}</span>
    </div>
  );
}
