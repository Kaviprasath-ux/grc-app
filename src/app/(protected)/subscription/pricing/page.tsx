"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Home, ChevronRight, Save, Shield, Users, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";

interface PricingRow {
  id: string;
  moduleCode: ModuleCode;
  tier: PlanTier;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  userLimit: number;
  vendorLimit: number | null;
  assessmentLimit: number | null;
  frameworkLimit: number | null;
  auditLimit: number | null;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

const MODULE_META: Record<ModuleCode, { label: string; icon: string; description: string }> = {
  GRC:             { label: "GRC",                icon: "🛡️", description: "Governance, Risk & Compliance" },
  TPRM:            { label: "TPRM",               icon: "👥", description: "Third-Party Risk Management" },
  INTERNAL_AUDIT:  { label: "Internal Audit",     icon: "🔍", description: "Audit planning, fieldwork & reporting" },
};

const TIER_ORDER: PlanTier[] = ["BASIC", "MEDIUM", "PRO"];

const TIER_BADGE_STYLE: Record<PlanTier, string> = {
  BASIC:  "bg-stone-100 text-stone-700 border-stone-300",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-300",
  PRO:    "bg-amber-100 text-amber-800 border-amber-300",
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function SubscriptionPricingPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<PricingRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load rows
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/grc/module-tier-pricing");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load pricing");
        if (!cancelled) setRows(json.data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function getDraftValue<K extends keyof PricingRow>(row: PricingRow, key: K): PricingRow[K] {
    const draft = drafts[row.id]?.[key];
    return draft !== undefined ? (draft as PricingRow[K]) : row[key];
  }

  function setDraftValue<K extends keyof PricingRow>(rowId: string, key: K, value: PricingRow[K]) {
    setDrafts((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [key]: value },
    }));
  }

  function isDirty(row: PricingRow): boolean {
    const d = drafts[row.id];
    if (!d) return false;
    return Object.keys(d).length > 0;
  }

  function resetRow(rowId: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }

  async function saveRow(row: PricingRow) {
    const draft = drafts[row.id];
    if (!draft) return;

    // Local validation: yearly ≤ 12 × monthly
    const monthly = (draft.monthlyPrice ?? row.monthlyPrice) as number;
    const yearly = (draft.yearlyPrice ?? row.yearlyPrice) as number;
    if (monthly > 0 && yearly > monthly * 12) {
      toast({
        variant: "destructive",
        title: t("Invalid pricing"),
        description: t(`Yearly price (${formatINR(yearly)}) exceeds 12× monthly (${formatINR(monthly * 12)})`),
      });
      return;
    }

    setSavingId(row.id);
    try {
      const res = await fetch(`/api/grc/module-tier-pricing/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");

      setRows((prev) => prev.map((r) => (r.id === row.id ? json.data : r)));
      resetRow(row.id);
      toast({
        title: t("Saved"),
        description: t(`${MODULE_META[row.moduleCode].label} ${row.tier} pricing updated`),
      });
    } catch (e) {
      toast({ variant: "destructive", title: t("Save failed"), description: (e as Error).message });
    } finally {
      setSavingId(null);
    }
  }

  // Group rows by module
  const grouped: Record<ModuleCode, PricingRow[]> = { GRC: [], TPRM: [], INTERNAL_AUDIT: [] };
  for (const r of rows) grouped[r.moduleCode].push(r);
  for (const m of Object.keys(grouped) as ModuleCode[]) {
    grouped[m].sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }

  if (loading) {
    return <div className="p-8 text-stone-600">{t("Loading pricing catalog…")}</div>;
  }
  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/grc" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />
          {t("GRC Admin")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Subscription Pricing")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t("Subscription Pricing")}</h1>
          <p className="mt-1 text-stone-600 max-w-2xl">
            {t("Configure tier prices and limits per module. Changes apply immediately to new quotes, signups, and renewals. Existing customer subscriptions keep their snapshotted prices until renewal.")}
          </p>
        </div>
      </div>

      {/* Module sections */}
      {(Object.keys(grouped) as ModuleCode[]).map((moduleCode) => {
        const meta = MODULE_META[moduleCode];
        const moduleRows = grouped[moduleCode];
        return (
          <Card key={moduleCode} className="overflow-hidden">
            <CardHeader className="bg-stone-50 border-b border-stone-200">
              <CardTitle className="flex items-center gap-3 text-lg">
                <span className="text-2xl">{meta.icon}</span>
                <span>{meta.label} {t("Module")}</span>
              </CardTitle>
              <CardDescription>{t(meta.description)}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-3">
                {moduleRows.map((row, idx) => (
                  <div
                    key={row.id}
                    className={`p-5 ${idx > 0 ? "border-t lg:border-t-0 lg:border-l border-stone-200" : ""}`}
                  >
                    {/* Tier header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={TIER_BADGE_STYLE[row.tier]}>
                          {row.tier}
                        </Badge>
                        <div className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={getDraftValue(row, "isActive") as boolean}
                            onCheckedChange={(v) => setDraftValue(row.id, "isActive", v)}
                            id={`active-${row.id}`}
                          />
                          <Label htmlFor={`active-${row.id}`} className="text-stone-600">
                            {getDraftValue(row, "isActive") ? t("Active") : t("Inactive")}
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <Label className="text-xs text-stone-600">{t("Monthly (₹)")}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={getDraftValue(row, "monthlyPrice") as number}
                          onChange={(e) => setDraftValue(row.id, "monthlyPrice", Number(e.target.value))}
                          className="font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-stone-600">{t("Yearly (₹)")}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={getDraftValue(row, "yearlyPrice") as number}
                          onChange={(e) => setDraftValue(row.id, "yearlyPrice", Number(e.target.value))}
                          className="font-mono"
                        />
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="space-y-3 mb-4">
                      <div>
                        <Label className="flex items-center gap-1 text-xs text-stone-600">
                          <Users className="h-3 w-3" /> {t("User limit")}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={getDraftValue(row, "userLimit") as number}
                          onChange={(e) => setDraftValue(row.id, "userLimit", Number(e.target.value))}
                          className="font-mono"
                        />
                      </div>

                      {moduleCode === "GRC" && (
                        <LimitInput
                          label={t("Framework limit")}
                          icon={<Shield className="h-3 w-3" />}
                          value={getDraftValue(row, "frameworkLimit") as number | null}
                          onChange={(v) => setDraftValue(row.id, "frameworkLimit", v)}
                        />
                      )}

                      {moduleCode === "TPRM" && (
                        <>
                          <LimitInput
                            label={t("Vendor limit")}
                            value={getDraftValue(row, "vendorLimit") as number | null}
                            onChange={(v) => setDraftValue(row.id, "vendorLimit", v)}
                          />
                          <LimitInput
                            label={t("Assessment limit")}
                            value={getDraftValue(row, "assessmentLimit") as number | null}
                            onChange={(v) => setDraftValue(row.id, "assessmentLimit", v)}
                          />
                        </>
                      )}

                      {moduleCode === "INTERNAL_AUDIT" && (
                        <LimitInput
                          label={t("Audit projects / yr")}
                          icon={<Search className="h-3 w-3" />}
                          value={getDraftValue(row, "auditLimit") as number | null}
                          onChange={(v) => setDraftValue(row.id, "auditLimit", v)}
                        />
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                      <span className="text-[10px] text-stone-500">
                        {t("Last updated")}: {new Date(row.updatedAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-2">
                        {isDirty(row) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resetRow(row.id)}
                            disabled={savingId === row.id}
                          >
                            {t("Reset")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => saveRow(row)}
                          disabled={!isDirty(row) || savingId === row.id}
                        >
                          <Save className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                          {savingId === row.id ? t("Saving…") : t("Save")}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Limit input with "Unlimited" toggle. Null value = unlimited.
 */
function LimitInput({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon?: React.ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const isUnlimited = value === null;
  const { t } = useLanguage();
  return (
    <div>
      <Label className="flex items-center gap-1 text-xs text-stone-600">
        {icon}
        {label}
      </Label>
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          min={0}
          disabled={isUnlimited}
          value={isUnlimited ? "" : (value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="font-mono flex-1"
          placeholder={isUnlimited ? t("Unlimited") : ""}
        />
        <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={isUnlimited}
            onChange={(e) => onChange(e.target.checked ? null : 0)}
            className="rounded"
          />
          {t("Unlimited")}
        </label>
      </div>
    </div>
  );
}
