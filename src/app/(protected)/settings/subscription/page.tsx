"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Home, ChevronRight, Plus, RefreshCcw, ArrowUp, Sparkles,
  Download, Users, Shield, Search, AlertCircle, Ban, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";
type PlanType = "BASE" | "GENERAL" | "COMPLIMENTARY" | null;
type BillingCycle = "MONTHLY" | "YEARLY";
type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
type SubscriptionType = "PAID" | "TRIAL" | "COMPLIMENTARY";

interface ModuleData {
  id: string;
  moduleCode: ModuleCode;
  tier: PlanTier;
  billingCycle: BillingCycle;
  unitPrice: number;
  cycleStart: string;
  cycleEnd: string;
  cancelledAt: string | null;
  status: SubscriptionStatus;
  // V2 lifecycle (null on V1 rows)
  planType?: PlanType;
  nextPlanType?: PlanType;
  baseEndDate?: string | null;
  contractEndDate?: string | null;
  generalBillingCycle?: BillingCycle | null;
  generalStartDate?: string | null;
  cancellationRequestedAt?: string | null;
  limits: {
    userLimit: number;
    userUsed: number | null;
    vendorLimit: number | null;
    vendorUsed: number | null;
    assessmentLimit: number | null;
    assessmentUsed: number | null;
    frameworkLimit: number | null;
    frameworkUsed: number | null;
    auditLimit: number | null;
    auditUsed: number | null;
  };
}

interface SubscriptionData {
  id: string;
  subscriptionType: SubscriptionType;
  status: SubscriptionStatus;
  autoRenew: boolean;
  trialEndsAt: string | null;
  gstin: string | null;
  nextRenewal: string | null;
  totalMonthly: number;
  totalYearly: number;
  modules: ModuleData[];
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: string;
    periodStart: string;
    periodEnd: string;
    total: number;
    status: string;
    pdfPath: string | null;
  }>;
}

const MODULE_META: Record<ModuleCode, { label: string; icon: string }> = {
  GRC:            { label: "GRC",            icon: "🛡️" },
  TPRM:           { label: "TPRM",           icon: "👥" },
  INTERNAL_AUDIT: { label: "Internal Audit", icon: "🔍" },
};

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  ACTIVE:        "bg-green-100 text-green-800 border-green-300",
  TRIAL:         "bg-blue-100 text-blue-800 border-blue-300",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-300",
  EXPIRED:       "bg-red-100 text-red-800 border-red-300",
  GRACE_PERIOD:  "bg-red-100 text-red-800 border-red-300",
  SUSPENDED:     "bg-stone-300 text-stone-800 border-stone-400",
  CANCELLED:     "bg-stone-100 text-stone-700 border-stone-300",
};

function formatINR(n: number): string { return n.toLocaleString("en-IN"); }
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const days = (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  return Math.floor(days);
}

export default function CustomerSubscriptionPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  async function reload() {
    const res = await fetch("/api/settings/subscription");
    const json = await res.json();
    if (res.ok && json.data) setData(json.data);
  }

  async function toggleAutoRenew() {
    if (!data || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/settings/subscription/auto-renew", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: !data.autoRenew }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast({ title: json.data.autoRenew ? t("Auto-renew enabled") : t("Auto-renew disabled") });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: t("Update failed"), description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function cancelSubscription() {
    setShowCancelDialog(false);
    setBusy(true);
    try {
      const res = await fetch("/api/settings/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 202) throw new Error(json.error || "Cancel failed");
      // 202 = queued for after contract end (V2 lock-in path)
      if (res.status === 202 || json.queued > 0) {
        toast({
          title: t("Cancellation queued"),
          description: json.availableOn
            ? `${t("Will process on")} ${formatDate(json.availableOn)}`
            : t("Will process when your contract ends."),
        });
      } else {
        toast({
          title: t("Subscription cancelled"),
          description: t("You'll keep access until your modules' cycle ends."),
        });
      }
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: t("Cancel failed"), description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/subscription");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Load failed");
        if (cancelled) return;
        // null data = no subscription yet → render Subscribe CTA below.
        // Don't treat this as an error.
        setData(json.data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="p-8 text-stone-600">{t("Loading subscription…")}</div>;

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-stone-400" />
            <p className="font-medium text-stone-900">{t("Couldn't load subscription")}</p>
            <p className="text-sm mt-1 text-stone-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No subscription yet — show self-service Subscribe CTA
  if (!data) {
    return (
      <div className="p-8 space-y-6 max-w-3xl">
        <nav className="flex items-center gap-2 text-sm text-stone-600">
          <Link href="/" className="flex items-center gap-1 hover:text-stone-900">
            <Home className="h-4 w-4" />{t("Home")}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-stone-900 font-medium">{t("Subscription & Billing")}</span>
        </nav>

        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t("Subscription & Billing")}</h1>
          <p className="mt-1 text-stone-600">{t("Pick a plan to get started.")}</p>
        </div>

        <Card className="border-stone-300">
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-amber-500" />
            <p className="font-medium text-stone-900 text-lg">{t("Subscribe to start using Verifai GRC")}</p>
            <p className="text-sm mt-2 text-stone-600 max-w-md mx-auto">
              {t("Pick the modules you need (GRC, TPRM, Internal Audit), choose a tier, and pay. Modules unlock instantly.")}
            </p>
            <Link href="/settings/subscription/subscribe">
              <Button className="mt-5">
                <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("Subscribe to a Plan")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isComp = data.subscriptionType === "COMPLIMENTARY";
  // V2 = any module has a planType set (BASE / GENERAL / COMPLIMENTARY).
  // V2 customers don't manually renew/add/upgrade — Razorpay autopay or
  // super-admin handles all of that. Only legacy V1 rows (planType=null) need
  // the manual toolbar.
  const isV2 = data.modules.some((m) => Boolean(m.planType));
  const showV1Toolbar = !isComp && !isV2;
  const isTrial = data.subscriptionType === "TRIAL";

  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />{t("Home")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Subscription & Billing")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t("Subscription & Billing")}</h1>
        <p className="mt-1 text-stone-600">
          {t("Manage your organization's modules, tiers, and billing.")}
        </p>
      </div>

      {/* Header card */}
      <Card className={isComp ? "border-purple-300 bg-purple-50/30" : ""}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              {isComp ? (
                <>
                  <div className="flex items-center gap-2 text-purple-700 mb-1">
                    <Sparkles className="h-5 w-5" />
                    <span className="font-semibold">{t("Complimentary Plan")}</span>
                  </div>
                  <p className="text-stone-700 text-sm">
                    {t("Full access to all your modules. No payment required, no expiry alerts.")}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-stone-600 text-sm">{t("Next renewal")}</div>
                  <div className="text-2xl font-semibold text-stone-900">{formatDate(data.nextRenewal)}</div>
                  {data.nextRenewal && (() => {
                    const d = daysUntil(data.nextRenewal);
                    if (d === null) return null;
                    if (d < 0) return <div className="text-sm text-red-600 mt-1">{t("Expired")} {-d} {t("day(s) ago")}</div>;
                    return <div className="text-sm text-stone-600 mt-1">{t("in")} {d} {t("days")}</div>;
                  })()}
                </>
              )}
            </div>

            <div className="text-right">
              {!isComp && (
                <>
                  {data.totalYearly > 0 && (
                    <div>
                      <span className="text-2xl font-semibold text-stone-900 font-mono">₹{formatINR(data.totalYearly)}</span>
                      <span className="text-stone-600 ltr:ml-1 rtl:mr-1">/{t("year")}</span>
                    </div>
                  )}
                  {data.totalMonthly > 0 && (
                    <div className={data.totalYearly > 0 ? "text-sm text-stone-600 mt-1" : ""}>
                      <span className={data.totalYearly > 0 ? "" : "text-2xl font-semibold text-stone-900 font-mono"}>
                        ₹{formatINR(data.totalMonthly)}
                      </span>
                      <span className="text-stone-600 ltr:ml-1 rtl:mr-1">/{t("month")}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-end gap-2 mt-2">
                <Badge variant="outline" className={STATUS_BADGE[data.status]}>
                  {data.status.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Trial countdown */}
          {isTrial && data.trialEndsAt && (
            <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 p-3 flex gap-2 text-sm text-blue-900">
              <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                {t("Your free trial ends on")} <strong>{formatDate(data.trialEndsAt)}</strong>
                {(() => {
                  const d = daysUntil(data.trialEndsAt);
                  return d !== null && d >= 0 ? ` (${d} ${t("days left")})` : "";
                })()}
                . {t("Subscribe before then to keep your modules.")}
              </div>
            </div>
          )}

          {/* V1 action toolbar — Renew / Add Module / Upgrade Tier.
              Hidden for V2 (autopay + no tiers) and COMPLIMENTARY (no payment). */}
          {showV1Toolbar && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link href="/settings/subscription/renew">
                <Button>
                  <RefreshCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Renew Subscription")}
                </Button>
              </Link>
              <Link href="/settings/subscription/add-module">
                <Button variant="outline">
                  <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Add Module")}
                </Button>
              </Link>
              <Link href="/settings/subscription/upgrade">
                <Button variant="outline">
                  <ArrowUp className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Upgrade Tier")}
                </Button>
              </Link>

              <div className="flex items-center gap-2 ltr:ml-auto rtl:mr-auto">
                <Switch
                  checked={data.autoRenew}
                  onCheckedChange={toggleAutoRenew}
                  disabled={busy}
                  id="auto-renew"
                />
                <label htmlFor="auto-renew" className="text-sm text-stone-700 cursor-pointer">
                  {t("Auto-renew")}
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============= V2 lifecycle banners ============= */}
      <V2LifecycleBanners modules={data.modules} t={t} />

      {/* Active modules grid */}
      <div>
        <h2 className="text-lg font-semibold text-stone-900 mb-3">{t("Active Modules")}</h2>
        {data.modules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-stone-600">
              {t("No modules in your subscription. Use Add Module to subscribe.")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.modules.map((m) => (
              <ModuleCard key={m.id} m={m} isComp={isComp} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* Danger zone: cancel subscription */}
      {!isComp && data.modules.some((m) => !m.cancelledAt) && (() => {
        // V2-aware cancel control:
        //  - All active modules in lock-in -> "Schedule cancellation" (queues)
        //  - Any cancellationRequestedAt set -> show "queued" state
        //  - Otherwise -> normal immediate cancel
        const active = data.modules.filter((m) => !m.cancelledAt);
        const allLocked = active.length > 0 && active.every((m) => {
          if (!m.contractEndDate) return false;
          return new Date(m.contractEndDate).getTime() > Date.now();
        });
        const anyQueued = active.some((m) => m.cancellationRequestedAt);
        const earliestContractEnd = active
          .map((m) => m.contractEndDate)
          .filter((d): d is string => Boolean(d))
          .sort()[0];
        const queuedRunsOn = earliestContractEnd ? formatDate(earliestContractEnd) : null;

        return (
          <Card className="border-red-200">
            <CardHeader className="border-b border-red-100 py-3 bg-red-50/50">
              <CardTitle className="text-base text-red-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {anyQueued
                  ? t("Cancellation queued")
                  : allLocked
                    ? t("Schedule cancellation")
                    : t("Cancel Subscription")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {anyQueued ? (
                <p className="text-sm text-stone-700">
                  {t("Cancellation scheduled for")} <strong>{queuedRunsOn}</strong>.
                </p>
              ) : (
                <p className="text-sm text-stone-700">
                  {t("Stops auto-renew. Access continues until your current cycle ends.")}
                </p>
              )}
              <Button
                variant="outline"
                className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => setShowCancelDialog(true)}
                disabled={busy || anyQueued}
              >
                <Ban className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {anyQueued
                  ? t("Already queued")
                  : allLocked
                    ? t("Schedule cancellation")
                    : t("Cancel Subscription")}
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* Cancel confirmation dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {t("Cancel your subscription?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("Stops auto-renew. Access continues until your current cycle ends.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("Keep Subscription")}</AlertDialogCancel>
            <AlertDialogAction onClick={cancelSubscription} className="bg-red-600 hover:bg-red-700" disabled={busy}>
              {t("Cancel Subscription")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Billing history */}
      <Card>
        <CardHeader className="border-b border-stone-200 py-3">
          <CardTitle className="text-base">{t("Billing History")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.invoices.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-600">{t("No invoices yet.")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-700">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t("Invoice")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("Date")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("Period")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Amount")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("Status")}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-stone-100">
                    <td className="px-4 py-2 font-mono text-stone-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2">{formatDate(inv.issueDate)}</td>
                    <td className="px-4 py-2 text-xs text-stone-600">
                      {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">₹{formatINR(inv.total)}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{inv.status}</Badge></td>
                    <td className="px-4 py-2 text-right">
                      {inv.pdfPath && (
                        <Link href={`/api/settings/subscription/invoices/${inv.id}/pdf`}>
                          <Button variant="ghost" size="sm">
                            <Download className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModuleCard({ m, isComp, t }: { m: ModuleData; isComp: boolean; t: (s: string) => string }) {
  const meta = MODULE_META[m.moduleCode];
  const cancelled = !!m.cancelledAt;

  // Legacy SubscriptionPlan stores 999_999 as the "unlimited" sentinel for
  // COMPLIMENTARY (and V2 unlimited flags). Treat any value at or above that
  // threshold as unlimited so we never render "1/999999" to the customer.
  function renderLimit(label: string, used: number | null, limit: number | null, icon?: React.ReactNode) {
    if (used === null) return null;
    const isUnlimited = limit === null || limit >= 999_999;
    const pct = isUnlimited || !limit || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
    return (
      <div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-stone-600 flex items-center gap-1">{icon}{label}</span>
          <span className="font-mono">{used}/{isUnlimited ? t("Unlimited") : limit}</span>
        </div>
        {!isUnlimited && limit !== null && limit > 0 && (
          <Progress value={pct} className={pct >= 90 ? "h-1 mt-1 [&>div]:bg-red-500" : "h-1 mt-1"} />
        )}
      </div>
    );
  }

  return (
    <Card className={cancelled ? "opacity-60" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.icon}</span>
            <div>
              <div className="font-semibold text-stone-900">{meta.label}</div>
              <div className="text-xs text-stone-500">
                {/* V1 tier badge — only shown for legacy rows (planType=null).
                    V2 rows (BASE / GENERAL / COMPLIMENTARY) have tier=BASIC as a
                    placeholder, not real, so we hide it. */}
                {!m.planType && (
                  <>
                    <Badge variant="outline" className="text-[10px] py-0">{m.tier}</Badge>
                    <span className="ltr:ml-1 rtl:mr-1">· </span>
                  </>
                )}
                {m.planType === "BASE" && (
                  <Badge variant="outline" className="text-[10px] py-0 bg-emerald-50 text-emerald-700 border-emerald-200">{t("Base")}</Badge>
                )}
                {m.planType === "GENERAL" && (
                  <Badge variant="outline" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-200">{t("General")}</Badge>
                )}
                {m.planType === "COMPLIMENTARY" && (
                  <Badge variant="outline" className="text-[10px] py-0 bg-purple-50 text-purple-700 border-purple-200">{t("Complimentary")}</Badge>
                )}
                {m.planType && <span className="ltr:ml-1 rtl:mr-1">· </span>}
                {m.billingCycle}
              </div>
            </div>
          </div>
          <Badge variant="outline" className={STATUS_BADGE[m.status]}>
            {m.status.replace("_", " ")}
          </Badge>
        </div>

        {!isComp && (
          <div className="text-sm">
            <span className="font-mono font-semibold">₹{formatINR(m.unitPrice)}</span>
            <span className="text-stone-600 ltr:ml-1 rtl:mr-1">
              /{m.billingCycle === "MONTHLY" ? t("month") : t("year")}
            </span>
          </div>
        )}

        <div className="text-xs text-stone-600">
          {t("Expires")}: <span className="font-medium">{formatDate(m.cycleEnd)}</span>
        </div>

        <div className="space-y-2 pt-2 border-t border-stone-100">
          {renderLimit(t("Users"), m.limits.userUsed, m.limits.userLimit, <Users className="h-3 w-3" />)}
          {m.moduleCode === "GRC" && renderLimit(t("Frameworks"), m.limits.frameworkUsed, m.limits.frameworkLimit, <Shield className="h-3 w-3" />)}
          {m.moduleCode === "TPRM" && (
            <>
              {renderLimit(t("Vendors"), m.limits.vendorUsed, m.limits.vendorLimit)}
              {renderLimit(t("Assessments"), m.limits.assessmentUsed, m.limits.assessmentLimit)}
            </>
          )}
          {m.moduleCode === "INTERNAL_AUDIT" && renderLimit(t("Audits"), m.limits.auditUsed, m.limits.auditLimit, <Search className="h-3 w-3" />)}
        </div>

        {cancelled && (
          <div className="text-xs text-red-600 flex items-center gap-1 pt-2 border-t border-stone-100">
            <Ban className="h-3 w-3" />
            {t("Cancelled — access ends on")} {formatDate(m.cycleEnd)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * V2 lifecycle banners. Each banner is independent — multiple can show.
 * Rendering rules:
 *   1. cancellationQueued banner — highest priority; explains pending cancel
 *   2. inBasePeriod banner — informational; "Year 1 Base ends X, General starts Y"
 *   3. inLockIn banner — when no queue but customer is in contract
 *   4. eligibleToCancel banner — contract over, can finally cancel
 * V1 rows have no V2 fields → renders nothing (graceful no-op).
 */
function V2LifecycleBanners({ modules, t }: { modules: ModuleData[]; t: (s: string) => string }) {
  const now = Date.now();
  const active = modules.filter((m) => !m.cancelledAt);
  if (active.length === 0) return null;

  // Anyone queued for cancellation?
  const queued = active.filter((m) => m.cancellationRequestedAt);
  const queuedDate = queued
    .map((m) => m.contractEndDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  // Earliest BASE flip
  const inBase = active.filter(
    (m) => m.planType === "BASE" && m.baseEndDate && new Date(m.baseEndDate).getTime() > now
  );
  const earliestBaseEnd = inBase
    .map((m) => m.baseEndDate!)
    .sort()[0];
  const generalCycle = inBase[0]?.generalBillingCycle;

  // Lock-in (active contract, no queue yet)
  const inLockIn = active.filter(
    (m) => m.contractEndDate && new Date(m.contractEndDate).getTime() > now
  );
  const earliestContractEnd = inLockIn
    .map((m) => m.contractEndDate!)
    .sort()[0];

  // Eligible to cancel (contract has ended, no queue)
  const eligibleToCancel = active.some(
    (m) =>
      m.contractEndDate &&
      new Date(m.contractEndDate).getTime() <= now &&
      !m.cancellationRequestedAt
  );

  // Nothing V2-relevant? Render nothing (V1 / pre-V2 customers).
  if (!queued.length && !inBase.length && !inLockIn.length && !eligibleToCancel) return null;

  return (
    <div className="space-y-2">
      {queued.length > 0 && queuedDate && (
        <Banner tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
          <strong>{t("Cancellation queued.")}</strong>{" "}
          {t("Will process on")} <strong>{formatDate(queuedDate)}</strong>{" "}
          {t("(end of your 2-year contract). Subscription remains active until then.")}
        </Banner>
      )}

      {inBase.length > 0 && earliestBaseEnd && (
        <Banner tone="emerald" icon={<Sparkles className="h-4 w-4" />}>
          <strong>{t("Year 1 (Base) ends")} {formatDate(earliestBaseEnd)}.</strong>{" "}
          {t("General plan auto-starts then —")}{" "}
          {generalCycle === "MONTHLY" ? t("billed monthly") : t("billed yearly")}.
        </Banner>
      )}

      {!queued.length && inLockIn.length > 0 && earliestContractEnd && (
        <Banner tone="blue" icon={<Shield className="h-4 w-4" />}>
          <strong>{t("Contract locked until")} {formatDate(earliestContractEnd)}.</strong>{" "}
          {t("Cancellation can be queued and will process at contract end.")}
        </Banner>
      )}

      {!queued.length && !inLockIn.length && eligibleToCancel && (
        <Banner tone="stone" icon={<AlertCircle className="h-4 w-4" />}>
          <strong>{t("Contract complete.")}</strong>{" "}
          {t("Your 2-year commitment has ended. You may cancel anytime.")}
        </Banner>
      )}
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "emerald" | "blue" | "stone";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    stone: "border-stone-200 bg-stone-50 text-stone-900",
  };
  return (
    <div className={`rounded-lg border p-3 flex items-start gap-2 text-sm ${styles[tone]}`}>
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>{children}</div>
    </div>
  );
}
