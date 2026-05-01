"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Home, ChevronRight, Save, RotateCcw, Info, Shield, Users, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";

const MODULE_META: Record<ModuleCode, { label: string; icon: string; description: string }> = {
  GRC:            { label: "GRC",            icon: "🛡️", description: "Governance, Risk & Compliance" },
  TPRM:           { label: "TPRM",           icon: "👥", description: "Third-Party Risk Management" },
  INTERNAL_AUDIT: { label: "Internal Audit", icon: "🔍", description: "Audit planning, fieldwork & reporting" },
};

const ALL_MODULES: ModuleCode[] = ["GRC", "TPRM", "INTERNAL_AUDIT"];

interface StandardTierPricing {
  id: string;
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

interface Override {
  id: string;
  moduleCode: ModuleCode;
  tier: PlanTier | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  userLimit: number | null;
  vendorLimit: number | null;
  assessmentLimit: number | null;
  frameworkLimit: number | null;
  auditLimit: number | null;
  reason: string | null;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
}

interface PerModuleDraft {
  enabled: boolean;
  tier: PlanTier;
  monthlyPrice: number | "";
  yearlyPrice: number | "";
  userLimit: number | "";
  vendorLimit: number | "";
  assessmentLimit: number | "";
  frameworkLimit: number | "";
  auditLimit: number | "";
  reason: string;
  validFrom: string;
  validUntil: string;
}

function emptyDraft(): PerModuleDraft {
  return {
    enabled: false, tier: "BASIC",
    monthlyPrice: "", yearlyPrice: "",
    userLimit: "", vendorLimit: "", assessmentLimit: "", frameworkLimit: "", auditLimit: "",
    reason: "", validFrom: "", validUntil: "",
  };
}

function fromOverride(o: Override): PerModuleDraft {
  return {
    enabled: o.isActive,
    tier: o.tier ?? "BASIC",
    monthlyPrice: o.monthlyPrice ?? "",
    yearlyPrice: o.yearlyPrice ?? "",
    userLimit: o.userLimit ?? "",
    vendorLimit: o.vendorLimit ?? "",
    assessmentLimit: o.assessmentLimit ?? "",
    frameworkLimit: o.frameworkLimit ?? "",
    auditLimit: o.auditLimit ?? "",
    reason: o.reason ?? "",
    validFrom: o.validFrom ? o.validFrom.slice(0, 10) : "",
    validUntil: o.validUntil ? o.validUntil.slice(0, 10) : "",
  };
}

export default function CustomerPricingOverridePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerAccountId } = use(params);
  const { t } = useLanguage();
  const { toast } = useToast();

  const [customer, setCustomer] = useState<{ id: string; code: string; name: string } | null>(null);
  const [tierPricing, setTierPricing] = useState<StandardTierPricing[]>([]);
  const [overrides, setOverrides] = useState<Record<ModuleCode, Override | null>>({ GRC: null, TPRM: null, INTERNAL_AUDIT: null });
  const [drafts, setDrafts] = useState<Record<ModuleCode, PerModuleDraft>>({ GRC: emptyDraft(), TPRM: emptyDraft(), INTERNAL_AUDIT: emptyDraft() });
  const [loading, setLoading] = useState(true);
  const [savingModule, setSavingModule] = useState<ModuleCode | null>(null);
  const [resetTarget, setResetTarget] = useState<ModuleCode | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [overridesRes, pricingRes] = await Promise.all([
          fetch(`/api/grc/customers/${customerAccountId}/plan-override`),
          fetch(`/api/grc/module-tier-pricing`),
        ]);
        const overridesJson = await overridesRes.json();
        const pricingJson = await pricingRes.json();
        if (!overridesRes.ok) throw new Error(overridesJson.error || "Failed to load overrides");
        if (!pricingRes.ok) throw new Error(pricingJson.error || "Failed to load pricing");
        if (cancelled) return;

        setCustomer(overridesJson.customer);
        setTierPricing(pricingJson.data);

        const overridesByModule: Record<ModuleCode, Override | null> = { GRC: null, TPRM: null, INTERNAL_AUDIT: null };
        const draftsByModule: Record<ModuleCode, PerModuleDraft> = { GRC: emptyDraft(), TPRM: emptyDraft(), INTERNAL_AUDIT: emptyDraft() };
        for (const o of overridesJson.data as Override[]) {
          overridesByModule[o.moduleCode] = o;
          draftsByModule[o.moduleCode] = fromOverride(o);
        }
        setOverrides(overridesByModule);
        setDrafts(draftsByModule);
      } catch (e) {
        toast({ variant: "destructive", title: t("Load failed"), description: (e as Error).message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerAccountId, toast, t]);

  function getStandard(moduleCode: ModuleCode, tier: PlanTier): StandardTierPricing | undefined {
    return tierPricing.find((p) => p.moduleCode === moduleCode && p.tier === tier);
  }

  function updateDraft<K extends keyof PerModuleDraft>(m: ModuleCode, key: K, value: PerModuleDraft[K]) {
    setDrafts((prev) => ({ ...prev, [m]: { ...prev[m], [key]: value } }));
  }

  async function saveModule(moduleCode: ModuleCode) {
    const draft = drafts[moduleCode];
    if (draft.monthlyPrice === "" && draft.yearlyPrice === "") {
      toast({ variant: "destructive", title: t("Set at least one price (monthly or yearly)") });
      return;
    }

    setSavingModule(moduleCode);
    try {
      const res = await fetch(`/api/grc/customers/${customerAccountId}/plan-override`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleCode,
          tier: draft.tier,
          monthlyPrice: draft.monthlyPrice === "" ? null : Number(draft.monthlyPrice),
          yearlyPrice: draft.yearlyPrice === "" ? null : Number(draft.yearlyPrice),
          userLimit: draft.userLimit === "" ? null : Number(draft.userLimit),
          vendorLimit: draft.vendorLimit === "" ? null : Number(draft.vendorLimit),
          assessmentLimit: draft.assessmentLimit === "" ? null : Number(draft.assessmentLimit),
          frameworkLimit: draft.frameworkLimit === "" ? null : Number(draft.frameworkLimit),
          auditLimit: draft.auditLimit === "" ? null : Number(draft.auditLimit),
          reason: draft.reason || null,
          validFrom: draft.validFrom ? new Date(draft.validFrom).toISOString() : null,
          validUntil: draft.validUntil ? new Date(draft.validUntil).toISOString() : null,
          isActive: draft.enabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setOverrides((prev) => ({ ...prev, [moduleCode]: json.data }));
      toast({ title: t("Saved"), description: t(`${MODULE_META[moduleCode].label} override updated`) });
    } catch (e) {
      toast({ variant: "destructive", title: t("Save failed"), description: (e as Error).message });
    } finally {
      setSavingModule(null);
    }
  }

  async function resetModule(moduleCode: ModuleCode) {
    setResetTarget(null);
    try {
      const res = await fetch(`/api/grc/customers/${customerAccountId}/plan-override?moduleCode=${moduleCode}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Reset failed");
      }
      setOverrides((prev) => ({ ...prev, [moduleCode]: null }));
      setDrafts((prev) => ({ ...prev, [moduleCode]: emptyDraft() }));
      toast({ title: t("Reset to standard pricing") });
    } catch (e) {
      toast({ variant: "destructive", title: t("Reset failed"), description: (e as Error).message });
    }
  }

  if (loading) return <div className="p-8 text-stone-600">{t("Loading…")}</div>;
  if (!customer) return <div className="p-8 text-red-600">{t("Customer not found")}</div>;

  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/grc" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />{t("GRC Admin")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/grc/customer-accounts" className="hover:text-stone-900">{t("Customer Accounts")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium">{customer.name}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Pricing Override")}</span>
      </nav>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            {t("Pricing Override")} <span className="text-stone-500 font-normal">— {customer.name}</span>
          </h1>
          <p className="mt-1 text-stone-600 max-w-3xl">
            {t("Set custom prices, tier, or limits for this customer. Overrides take effect on the next quote — existing module subscriptions retain their snapshot price until renewal.")}
          </p>
        </div>
      </div>

      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex gap-2 text-sm text-amber-900">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          {t("Leave a price blank to fall through to the standard catalog price for that cycle. Setting both prices to ₹0 grants effectively-free access — but consider a Complimentary subscription instead (Subscription drill-in → Grant Complimentary).")}
        </div>
      </div>

      {ALL_MODULES.map((moduleCode) => {
        const meta = MODULE_META[moduleCode];
        const draft = drafts[moduleCode];
        const standard = getStandard(moduleCode, draft.tier);
        const hasActiveOverride = overrides[moduleCode]?.isActive ?? false;

        return (
          <Card key={moduleCode} className="overflow-hidden">
            <CardHeader className="bg-stone-50 border-b border-stone-200">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <span>{meta.label}</span>
                  {hasActiveOverride && <Badge className="bg-amber-100 text-amber-800 border-amber-300">{t("Override active")}</Badge>}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(v) => updateDraft(moduleCode, "enabled", v)}
                    id={`enable-${moduleCode}`}
                  />
                  <Label htmlFor={`enable-${moduleCode}`}>
                    {draft.enabled ? t("Override enabled") : t("Use standard pricing")}
                  </Label>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 grid lg:grid-cols-2 gap-6">
              {/* LEFT: Standard reference */}
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-wide text-stone-600">{t("Standard catalog price")}</div>
                <div>
                  <Label className="text-xs">{t("Tier")}</Label>
                  <Select
                    value={draft.tier}
                    onValueChange={(v) => updateDraft(moduleCode, "tier", v as PlanTier)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BASIC">Basic</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="PRO">Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {standard && (
                  <div className="rounded-md bg-stone-50 border border-stone-200 p-3 text-sm space-y-1.5">
                    <div className="flex justify-between"><span className="text-stone-600">{t("Monthly")}</span><span className="font-mono">₹{standard.monthlyPrice.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span className="text-stone-600">{t("Yearly")}</span><span className="font-mono">₹{standard.yearlyPrice.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between"><span className="text-stone-600 flex items-center gap-1"><Users className="h-3 w-3" />{t("Users")}</span><span className="font-mono">{standard.userLimit}</span></div>
                    {moduleCode === "GRC" && (
                      <div className="flex justify-between"><span className="text-stone-600 flex items-center gap-1"><Shield className="h-3 w-3" />{t("Frameworks")}</span><span className="font-mono">{standard.frameworkLimit ?? "∞"}</span></div>
                    )}
                    {moduleCode === "TPRM" && (
                      <>
                        <div className="flex justify-between"><span className="text-stone-600">{t("Vendors")}</span><span className="font-mono">{standard.vendorLimit ?? "∞"}</span></div>
                        <div className="flex justify-between"><span className="text-stone-600">{t("Assessments")}</span><span className="font-mono">{standard.assessmentLimit ?? "∞"}</span></div>
                      </>
                    )}
                    {moduleCode === "INTERNAL_AUDIT" && (
                      <div className="flex justify-between"><span className="text-stone-600 flex items-center gap-1"><Search className="h-3 w-3" />{t("Audits/yr")}</span><span className="font-mono">{standard.auditLimit ?? "∞"}</span></div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT: Override fields */}
              <div className={`space-y-3 ${draft.enabled ? "" : "opacity-50 pointer-events-none"}`}>
                <div className="text-xs font-medium uppercase tracking-wide text-amber-900">{t("Override values")}</div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("Monthly (₹)")}</Label>
                    <Input
                      type="number" min={0}
                      placeholder={t("Use standard")}
                      value={draft.monthlyPrice}
                      onChange={(e) => updateDraft(moduleCode, "monthlyPrice", e.target.value === "" ? "" : Number(e.target.value))}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t("Yearly (₹)")}</Label>
                    <Input
                      type="number" min={0}
                      placeholder={t("Use standard")}
                      value={draft.yearlyPrice}
                      onChange={(e) => updateDraft(moduleCode, "yearlyPrice", e.target.value === "" ? "" : Number(e.target.value))}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("User limit")}</Label>
                    <Input
                      type="number" min={0}
                      placeholder={t("Use standard")}
                      value={draft.userLimit}
                      onChange={(e) => updateDraft(moduleCode, "userLimit", e.target.value === "" ? "" : Number(e.target.value))}
                      className="font-mono"
                    />
                  </div>
                  {moduleCode === "GRC" && (
                    <div>
                      <Label className="text-xs">{t("Framework limit")}</Label>
                      <Input
                        type="number" min={0}
                        placeholder={t("Use standard")}
                        value={draft.frameworkLimit}
                        onChange={(e) => updateDraft(moduleCode, "frameworkLimit", e.target.value === "" ? "" : Number(e.target.value))}
                        className="font-mono"
                      />
                    </div>
                  )}
                  {moduleCode === "TPRM" && (
                    <>
                      <div>
                        <Label className="text-xs">{t("Vendor limit")}</Label>
                        <Input
                          type="number" min={0}
                          placeholder={t("Use standard")}
                          value={draft.vendorLimit}
                          onChange={(e) => updateDraft(moduleCode, "vendorLimit", e.target.value === "" ? "" : Number(e.target.value))}
                          className="font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">{t("Assessment limit")}</Label>
                        <Input
                          type="number" min={0}
                          placeholder={t("Use standard")}
                          value={draft.assessmentLimit}
                          onChange={(e) => updateDraft(moduleCode, "assessmentLimit", e.target.value === "" ? "" : Number(e.target.value))}
                          className="font-mono"
                        />
                      </div>
                    </>
                  )}
                  {moduleCode === "INTERNAL_AUDIT" && (
                    <div>
                      <Label className="text-xs">{t("Audits/yr")}</Label>
                      <Input
                        type="number" min={0}
                        placeholder={t("Use standard")}
                        value={draft.auditLimit}
                        onChange={(e) => updateDraft(moduleCode, "auditLimit", e.target.value === "" ? "" : Number(e.target.value))}
                        className="font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("Valid from")}</Label>
                    <Input type="date" value={draft.validFrom} onChange={(e) => updateDraft(moduleCode, "validFrom", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{t("Valid until")}</Label>
                    <Input type="date" value={draft.validUntil} onChange={(e) => updateDraft(moduleCode, "validUntil", e.target.value)} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">{t("Reason")}</Label>
                  <Textarea
                    rows={2}
                    placeholder={t("e.g., Strategic partner, Beta tester, Multi-year contract")}
                    value={draft.reason}
                    onChange={(e) => updateDraft(moduleCode, "reason", e.target.value)}
                  />
                </div>
              </div>

              {/* Action buttons span both columns */}
              <div className="lg:col-span-2 flex justify-end gap-2 pt-3 border-t border-stone-100">
                {hasActiveOverride && (
                  <Button variant="outline" onClick={() => setResetTarget(moduleCode)}>
                    <RotateCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Reset to standard")}
                  </Button>
                )}
                <Button
                  onClick={() => saveModule(moduleCode)}
                  disabled={savingModule === moduleCode}
                >
                  <Save className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {savingModule === moduleCode ? t("Saving…") : t("Save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Reset")} {resetTarget ? MODULE_META[resetTarget].label : ""} {t("override?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("This customer will revert to standard catalog pricing for this module on next quote. Existing module subscriptions keep their snapshot price until renewal.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetTarget && resetModule(resetTarget)}>
              {t("Reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
