"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Home, ChevronRight, Save, Shield, Users, Search, Building2, ClipboardCheck, Database, Sparkles, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";
type PlanType = "BASE" | "GENERAL";

interface PricingRow {
  id: string;
  moduleCode: ModuleCode;
  planType: PlanType;
  monthlyPrice: number | null;
  yearlyPrice: number;
  currency: string;
  userLimit: number;
  unlimitedUsers: boolean;
  frameworkLimit: number | null;
  unlimitedFrameworks: boolean;
  vendorLimit: number | null;
  unlimitedVendors: boolean;
  assessmentLimit: number | null;
  unlimitedAssessments: boolean;
  auditLimit: number | null;
  unlimitedAudits: boolean;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

const MODULE_META: Record<ModuleCode, { label: string; icon: React.ReactNode; description: string }> = {
  GRC:                { label: "GRC",                icon: <Shield className="h-5 w-5" />,         description: "Governance, Risk & Compliance" },
  TPRM:               { label: "TPRM",               icon: <Building2 className="h-5 w-5" />,      description: "Third-Party Risk Management" },
  INTERNAL_AUDIT:     { label: "Internal Audit",     icon: <ClipboardCheck className="h-5 w-5" />, description: "Audit planning, fieldwork & reporting" },
  TECHNICAL_EVIDENCE: { label: "Technical Evidence", icon: <Database className="h-5 w-5" />,       description: "Automated control evidence collection" },
};

const MODULE_ORDER: ModuleCode[] = ["GRC", "TPRM", "INTERNAL_AUDIT", "TECHNICAL_EVIDENCE"];

const PLAN_META: Record<PlanType, { label: string; subtitle: string; icon: React.ReactNode; badge: string }> = {
  BASE:    { label: "Base Plans",    subtitle: "Year-1 promotional plans (yearly billing only)",                  icon: <Sparkles className="h-5 w-5" />, badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  GENERAL: { label: "General Plans", subtitle: "Year-2+ standard plans (monthly or annual; 2-year contract)",     icon: <Calendar className="h-5 w-5" />, badge: "bg-blue-100 text-blue-800 border-blue-300" },
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

export default function PlanPricingPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<PricingRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/grc/module-plan-pricing");
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
    setDrafts((prev) => ({ ...prev, [rowId]: { ...prev[rowId], [key]: value } }));
  }

  function isDirty(row: PricingRow): boolean {
    const d = drafts[row.id];
    return d ? Object.keys(d).length > 0 : false;
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

    if (row.planType === "GENERAL") {
      const monthly = (draft.monthlyPrice ?? row.monthlyPrice) as number | null;
      const yearly = (draft.yearlyPrice ?? row.yearlyPrice) as number;
      if (monthly !== null && monthly > 0 && yearly > monthly * 12) {
        toast({
          variant: "destructive",
          title: t("Invalid pricing"),
          description: t(`Yearly (₹${formatINR(yearly)}) must not exceed 12× monthly (₹${formatINR(monthly * 12)})`),
        });
        return;
      }
    }

    setSavingId(row.id);
    try {
      const res = await fetch(`/api/grc/module-plan-pricing/${row.id}`, {
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
        description: `${MODULE_META[row.moduleCode].label} ${PLAN_META[row.planType].label.replace(" Plans", "")} ${t("pricing updated")}`,
      });
    } catch (e) {
      toast({ variant: "destructive", title: t("Save failed"), description: (e as Error).message });
    } finally {
      setSavingId(null);
    }
  }

  // Group by planType
  const grouped: Record<PlanType, PricingRow[]> = { BASE: [], GENERAL: [] };
  for (const r of rows) grouped[r.planType].push(r);
  for (const p of Object.keys(grouped) as PlanType[]) {
    grouped[p].sort((a, b) => MODULE_ORDER.indexOf(a.moduleCode) - MODULE_ORDER.indexOf(b.moduleCode));
  }

  if (loading) return <div className="p-8 text-stone-600">{t("Loading plan pricing…")}</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/grc" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />
          {t("GRC Admin")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Plan Pricing")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t("Plan Pricing")}</h1>
        <p className="mt-1 text-stone-600 max-w-3xl">
          {t("Configure prices and limits for each module on Base and General plans. Year 1 = Base; Year 2+ = General. Customers signing up after a save see the new values immediately; existing subscriptions keep their snapshotted limits.")}
        </p>
      </div>

      {(Object.keys(grouped) as PlanType[]).map((planType) => {
        const meta = PLAN_META[planType];
        const planRows = grouped[planType];
        return (
          <Card key={planType} className="overflow-hidden">
            <CardHeader className="bg-stone-50 border-b border-stone-200">
              <CardTitle className="flex items-center gap-3 text-lg">
                <Badge variant="outline" className={meta.badge}>{meta.icon}</Badge>
                <span>{t(meta.label)}</span>
              </CardTitle>
              <CardDescription>{t(meta.subtitle)}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-3">
                {planRows.map((row, idx) => {
                  const moduleMeta = MODULE_META[row.moduleCode];
                  return (
                    <div
                      key={row.id}
                      className={`p-5 ${idx > 0 ? "border-t lg:border-t-0 lg:border-l border-stone-200" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-stone-700">
                          {moduleMeta.icon}
                          <span className="font-medium">{moduleMeta.label}</span>
                        </div>
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

                      {/* Prices */}
                      {row.planType === "BASE" ? (
                        <div className="mb-4">
                          <Label className="text-xs text-stone-600">{t("Yearly price (₹)")}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={getDraftValue(row, "yearlyPrice") as number}
                            onChange={(e) => setDraftValue(row.id, "yearlyPrice", Number(e.target.value))}
                            className="font-mono"
                          />
                          <p className="text-[10px] text-stone-500 mt-1">{t("Base plans bill yearly only")}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div>
                            <Label className="text-xs text-stone-600">{t("Monthly (₹)")}</Label>
                            <Input
                              type="number"
                              min={0}
                              value={(getDraftValue(row, "monthlyPrice") as number | null) ?? 0}
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
                      )}

                      {/* Limits */}
                      <div className="space-y-3 mb-4">
                        <LimitInput
                          label={t("User limit")}
                          icon={<Users className="h-3 w-3" />}
                          value={getDraftValue(row, "userLimit") as number}
                          unlimited={getDraftValue(row, "unlimitedUsers") as boolean}
                          onValueChange={(v) => setDraftValue(row.id, "userLimit", v)}
                          onUnlimitedChange={(v) => setDraftValue(row.id, "unlimitedUsers", v)}
                          allowZero
                        />

                        {row.moduleCode === "GRC" && (
                          <LimitInput
                            label={t("Framework limit")}
                            icon={<Shield className="h-3 w-3" />}
                            value={(getDraftValue(row, "frameworkLimit") as number | null) ?? 0}
                            unlimited={getDraftValue(row, "unlimitedFrameworks") as boolean}
                            onValueChange={(v) => setDraftValue(row.id, "frameworkLimit", v)}
                            onUnlimitedChange={(v) => setDraftValue(row.id, "unlimitedFrameworks", v)}
                          />
                        )}

                        {row.moduleCode === "TPRM" && (
                          <>
                            <LimitInput
                              label={t("Vendor limit")}
                              value={(getDraftValue(row, "vendorLimit") as number | null) ?? 0}
                              unlimited={getDraftValue(row, "unlimitedVendors") as boolean}
                              onValueChange={(v) => setDraftValue(row.id, "vendorLimit", v)}
                              onUnlimitedChange={(v) => setDraftValue(row.id, "unlimitedVendors", v)}
                            />
                            <LimitInput
                              label={t("Assessment limit")}
                              value={(getDraftValue(row, "assessmentLimit") as number | null) ?? 0}
                              unlimited={getDraftValue(row, "unlimitedAssessments") as boolean}
                              onValueChange={(v) => setDraftValue(row.id, "assessmentLimit", v)}
                              onUnlimitedChange={(v) => setDraftValue(row.id, "unlimitedAssessments", v)}
                            />
                          </>
                        )}

                        {row.moduleCode === "INTERNAL_AUDIT" && (
                          <LimitInput
                            label={t("Audit projects / yr")}
                            icon={<Search className="h-3 w-3" />}
                            value={(getDraftValue(row, "auditLimit") as number | null) ?? 0}
                            unlimited={getDraftValue(row, "unlimitedAudits") as boolean}
                            onValueChange={(v) => setDraftValue(row.id, "auditLimit", v)}
                            onUnlimitedChange={(v) => setDraftValue(row.id, "unlimitedAudits", v)}
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                        <span className="text-[10px] text-stone-500">
                          {t("Last updated")}: {new Date(row.updatedAt).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          {isDirty(row) && (
                            <Button variant="outline" size="sm" onClick={() => resetRow(row.id)} disabled={savingId === row.id}>
                              {t("Reset")}
                            </Button>
                          )}
                          <Button size="sm" onClick={() => saveRow(row)} disabled={!isDirty(row) || savingId === row.id}>
                            <Save className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                            {savingId === row.id ? t("Saving…") : t("Save")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Limit input with adjacent Unlimited checkbox. When Unlimited is checked,
 * the numeric input is disabled and the unlimited<Field> boolean is true.
 */
function LimitInput({
  label,
  icon,
  value,
  unlimited,
  onValueChange,
  onUnlimitedChange,
  allowZero,
}: {
  label: string;
  icon?: React.ReactNode;
  value: number;
  unlimited: boolean;
  onValueChange: (v: number) => void;
  onUnlimitedChange: (v: boolean) => void;
  allowZero?: boolean;
}) {
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
          min={allowZero ? 0 : 0}
          disabled={unlimited}
          value={unlimited ? "" : value}
          onChange={(e) => onValueChange(Number(e.target.value))}
          className="font-mono flex-1"
          placeholder={unlimited ? t("Unlimited") : ""}
        />
        <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => onUnlimitedChange(e.target.checked)}
            className="rounded"
          />
          {t("Unlimited")}
        </label>
      </div>
    </div>
  );
}
