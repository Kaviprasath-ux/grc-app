"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Tag, AlertCircle, Eye, EyeOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

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

interface FormState {
  // Step 1
  organizationName: string;
  gstin: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  // Step 2
  selections: Array<{ moduleCode: ModuleCode; tier: PlanTier; enabled: boolean }>;
  // Step 3
  cycle: BillingCycle;
}

const INITIAL_FORM: FormState = {
  organizationName: "",
  gstin: "",
  adminFirstName: "",
  adminLastName: "",
  adminEmail: "",
  adminPassword: "",
  selections: ALL_MODULES.map((m) => ({ moduleCode: m, tier: "BASIC", enabled: false })),
  cycle: "YEARLY",
};

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [discounts, setDiscounts] = useState<BundleDiscountRow[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function getPrice(moduleCode: ModuleCode, tier: PlanTier): { monthly: number; yearly: number } {
    const row = pricing.find((p) => p.moduleCode === moduleCode && p.tier === tier);
    return { monthly: row?.monthlyPrice ?? 0, yearly: row?.yearlyPrice ?? 0 };
  }

  // Live total (yearly cycle if chosen)
  const enabledLines = useMemo(
    () => form.selections.filter((s) => s.enabled),
    [form.selections]
  );

  const subtotal = useMemo(() => {
    return enabledLines.reduce((sum, s) => {
      const p = getPrice(s.moduleCode, s.tier);
      return sum + (form.cycle === "MONTHLY" ? p.monthly : p.yearly);
    }, 0);
  }, [enabledLines, form.cycle, pricing]);

  // Best matching discount
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

  // ── Validation per step ──
  function step1Valid() {
    return (
      form.organizationName.trim().length >= 2 &&
      form.adminFirstName.trim().length >= 1 &&
      form.adminLastName.trim().length >= 1 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail) &&
      form.adminPassword.length >= 8 &&
      (form.gstin === "" || form.gstin.length === 15)
    );
  }
  function step2Valid() {
    return enabledLines.length >= 1;
  }

  async function submit(path: "TRIAL" | "SUBSCRIBE") {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName.trim(),
          gstin: form.gstin.trim() || null,
          adminFirstName: form.adminFirstName.trim(),
          adminLastName: form.adminLastName.trim(),
          adminEmail: form.adminEmail.trim().toLowerCase(),
          adminPassword: form.adminPassword,
          modules: enabledLines.map((s) => ({ moduleCode: s.moduleCode, tier: s.tier })),
          cycle: form.cycle,
          path,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Signup failed");

      // Auto sign-in via NextAuth credentials
      const signed = await signIn("credentials", {
        username: json.data.userName,
        password: form.adminPassword,
        redirect: false,
      });
      if (signed?.error) {
        // If auto-login fails, send to login page
        router.push(`/login?username=${encodeURIComponent(json.data.userName)}&signedUp=1`);
        return;
      }
      router.push("/settings/subscription?signedUp=1");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
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
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === n ? "bg-stone-900 text-white"
                : step > n ? "bg-green-600 text-white"
                : "bg-stone-200 text-stone-500"
              }`}>
                {step > n ? <Check className="h-4 w-4" /> : n}
              </div>
              {n < 4 && <div className={`h-0.5 w-12 ${step > n ? "bg-green-600" : "bg-stone-200"}`} />}
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
                <div>
                  <Label>Work email *</Label>
                  <Input type="email" value={form.adminEmail} onChange={(e) => update("adminEmail", e.target.value)} placeholder="you@company.com" />
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
                <div>
                  <Label>GSTIN <span className="text-xs text-stone-500">(optional, 15 chars)</span></Label>
                  <Input
                    value={form.gstin}
                    onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                    placeholder="27AAACS1234A1Z5"
                    maxLength={15}
                    className="font-mono"
                  />
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
                <p className="text-sm text-stone-600">Pick at least one module. Each module can be subscribed at Basic, Medium, or Pro.</p>
                {form.selections.map((s, idx) => {
                  const meta = MODULE_META[s.moduleCode];
                  return (
                    <div key={s.moduleCode} className={`border rounded-md p-4 ${s.enabled ? "border-stone-400 bg-stone-50" : "border-stone-200"}`}>
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
                      </div>
                      {s.enabled && (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          {(["BASIC", "MEDIUM", "PRO"] as PlanTier[]).map((tier) => {
                            const p = getPrice(s.moduleCode, tier);
                            return (
                              <button
                                key={tier}
                                onClick={() => update("selections", form.selections.map((x, i) => i === idx ? { ...x, tier } : x))}
                                className={`p-3 rounded-md border-2 text-left ${
                                  s.tier === tier ? `border-stone-900 ${TIER_BADGE[tier]}` : "border-stone-200 hover:border-stone-400 bg-white"
                                }`}
                              >
                                <div className="text-xs font-semibold">{tier}</div>
                                <div className="text-sm font-mono mt-1">
                                  {form.cycle === "MONTHLY" ? `₹${formatINR(p.monthly)}/mo` : `₹${formatINR(p.yearly)}/yr`}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
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
                <h2 className="text-xl font-semibold text-stone-900">Choose billing cycle</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(["MONTHLY", "YEARLY"] as BillingCycle[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => update("cycle", c)}
                      className={`p-5 rounded-md border-2 text-left transition-colors ${
                        form.cycle === c ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400"
                      }`}
                    >
                      <div className="font-semibold text-lg">{c === "MONTHLY" ? "Monthly" : "Yearly"}</div>
                      {c === "YEARLY" && (
                        <div className="text-sm text-green-700 mt-1">Save 2 months free</div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Live summary */}
                <div className="rounded-md bg-stone-50 border border-stone-200 p-4 text-sm space-y-2">
                  {enabledLines.map((s) => {
                    const p = getPrice(s.moduleCode, s.tier);
                    const cyclePrice = form.cycle === "MONTHLY" ? p.monthly : p.yearly;
                    return (
                      <div key={s.moduleCode} className="flex justify-between">
                        <span>{MODULE_META[s.moduleCode].label} — {s.tier}</span>
                        <span className="font-mono">₹{formatINR(cyclePrice)}</span>
                      </div>
                    );
                  })}
                  <div className="border-t pt-2 flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{formatINR(subtotal)}</span>
                  </div>
                  {bestDiscount && (
                    <div className="flex justify-between text-green-700">
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{bestDiscount.rule.name}</span>
                      <span className="font-mono">−₹{formatINR(bestDiscount.amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-600">
                    <span>GST 18%</span>
                    <span className="font-mono">₹{formatINR(taxAmount)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold text-stone-900">
                    <span>Total {form.cycle === "MONTHLY" ? "/month" : "/year"}</span>
                    <span className="font-mono">₹{formatINR(total)}</span>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    Back
                  </Button>
                  <Button onClick={() => setStep(4)}>
                    Continue
                    <ArrowRight className="h-4 w-4 ltr:ml-1 rtl:mr-1" />
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-stone-900">Almost there — choose how to start</h2>

                {/* Trial card */}
                <button
                  onClick={() => !submitting && submit("TRIAL")}
                  disabled={submitting}
                  className="w-full text-left border-2 border-blue-300 bg-blue-50/50 rounded-md p-5 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="h-5 w-5 text-blue-700" />
                    <h3 className="font-semibold text-stone-900">Start 14-day free trial</h3>
                  </div>
                  <p className="text-sm text-stone-700">
                    Full access to your selected modules at <strong>Basic tier</strong>. No payment, no credit card.
                    Subscribe before day 14 to keep going.
                  </p>
                  {submitting && (
                    <div className="mt-3 flex items-center gap-2 text-stone-600 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating your account…
                    </div>
                  )}
                </button>

                {/* Subscribe card */}
                <button
                  onClick={() => !submitting && submit("SUBSCRIBE")}
                  disabled={submitting}
                  className="w-full text-left border-2 border-stone-900 bg-stone-50 rounded-md p-5 hover:bg-stone-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-stone-900">Subscribe — ₹{formatINR(total)}{form.cycle === "MONTHLY" ? "/mo" : "/yr"}</h3>
                    <Badge>Recommended</Badge>
                  </div>
                  <p className="text-sm text-stone-700">
                    Full access at your chosen tiers. Auto-renews so your team never loses access.
                    Cancel anytime.
                  </p>
                </button>

                <div className="flex justify-start pt-2">
                  <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}>
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
  );
}
