"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Home, ChevronRight, Search, Users, IndianRupee, TrendingUp,
  Sparkles, Clock, AlertTriangle, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
type SubscriptionType = "PAID" | "TRIAL" | "COMPLIMENTARY";
type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT" | "TECHNICAL_EVIDENCE";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";
type BillingCycle = "MONTHLY" | "YEARLY";

interface SubscriptionRow {
  subscriptionId: string;
  customerAccountId: string;
  customerCode: string;
  customerName: string;
  subscriptionType: SubscriptionType;
  status: SubscriptionStatus;
  autoRenew: boolean;
  trialEndsAt: string | null;
  modules: Array<{
    moduleCode: ModuleCode;
    tier: PlanTier;
    billingCycle: BillingCycle;
    unitPrice: number;
    cycleEnd: string;
    cancelledAt: string | null;
  }>;
  mrr: number;
  arr: number;
  nextRenewal: string | null;
  notes: string | null;
}

interface Stats {
  totalCustomers: number;
  activePaying: number;
  trialCount: number;
  complimentaryCount: number;
  suspendedCount: number;
  expiringSoonCount: number;
  mrr: number;
  arr: number;
}

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  ACTIVE:        "bg-green-100 text-green-800 border-green-300",
  TRIAL:         "bg-blue-100 text-blue-800 border-blue-300",
  EXPIRING_SOON: "bg-amber-100 text-amber-800 border-amber-300",
  EXPIRED:       "bg-red-100 text-red-800 border-red-300",
  GRACE_PERIOD:  "bg-red-100 text-red-800 border-red-300",
  SUSPENDED:     "bg-stone-300 text-stone-800 border-stone-400",
  CANCELLED:     "bg-stone-100 text-stone-700 border-stone-300",
};

const TYPE_BADGE: Record<SubscriptionType, string> = {
  PAID:          "bg-stone-100 text-stone-700 border-stone-300",
  TRIAL:         "bg-blue-50 text-blue-700 border-blue-200",
  COMPLIMENTARY: "bg-purple-100 text-purple-800 border-purple-300",
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AllSubscriptionsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters (client-side; server respects them but keeping local for snappy UI)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<SubscriptionType | "ALL">("ALL");
  const [cycleFilter, setCycleFilter] = useState<BillingCycle | "ALL">("ALL");
  const [moduleFilter, setModuleFilter] = useState<ModuleCode | "ALL">("ALL");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [listRes, statsRes] = await Promise.all([
          fetch("/api/grc/subscriptions"),
          fetch("/api/grc/subscriptions/stats"),
        ]);
        const listJson = await listRes.json();
        const statsJson = await statsRes.json();
        if (!listRes.ok) throw new Error(listJson.error || "Failed to load subscriptions");
        if (!statsRes.ok) throw new Error(statsJson.error || "Failed to load stats");
        if (cancelled) return;
        setRows(listJson.data);
        setStats(statsJson.data);
      } catch (e) {
        toast({ variant: "destructive", title: t("Load failed"), description: (e as Error).message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast, t]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!`${r.customerCode} ${r.customerName}`.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && r.subscriptionType !== typeFilter) return false;
      if (cycleFilter !== "ALL" && !r.modules.some((m) => m.billingCycle === cycleFilter)) return false;
      if (moduleFilter !== "ALL" && !r.modules.some((m) => m.moduleCode === moduleFilter)) return false;
      return true;
    });
  }, [rows, search, statusFilter, typeFilter, cycleFilter, moduleFilter]);

  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/grc" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />{t("GRC Admin")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("All Subscriptions")}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-stone-900">{t("All Subscriptions")}</h1>
        <p className="mt-1 text-stone-600">
          {t("Every customer's subscription state across modules and tiers.")}
        </p>
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <KpiCard icon={<Users className="h-4 w-4" />} label={t("Active paying")} value={String(stats.activePaying)} />
          <KpiCard icon={<IndianRupee className="h-4 w-4" />} label={t("MRR")} value={`₹${formatINR(stats.mrr)}`} accent />
          <KpiCard icon={<TrendingUp className="h-4 w-4" />} label={t("ARR")} value={`₹${formatINR(stats.arr)}`} accent />
          <KpiCard icon={<Clock className="h-4 w-4" />} label={t("Expiring 30d")} value={String(stats.expiringSoonCount)} warning={stats.expiringSoonCount > 0} />
          <KpiCard icon={<Sparkles className="h-4 w-4" />} label={t("Trials")} value={String(stats.trialCount)} />
          <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label={t("Suspended")} value={String(stats.suspendedCount)} danger={stats.suspendedCount > 0} />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              className="ltr:pl-9 rtl:pr-9"
              placeholder={t("Search organization or code…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger><SelectValue placeholder={t("Status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("All statuses")}</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="TRIAL">Trial</SelectItem>
              <SelectItem value="EXPIRING_SOON">Expiring soon</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="GRACE_PERIOD">Grace period</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger><SelectValue placeholder={t("Type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("All types")}</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="TRIAL">Trial</SelectItem>
              <SelectItem value="COMPLIMENTARY">Complimentary</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cycleFilter} onValueChange={(v) => setCycleFilter(v as typeof cycleFilter)}>
            <SelectTrigger><SelectValue placeholder={t("Cycle")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("Any cycle")}</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as typeof moduleFilter)}>
            <SelectTrigger><SelectValue placeholder={t("Module")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("Any module")}</SelectItem>
              <SelectItem value="GRC">GRC</SelectItem>
              <SelectItem value="TPRM">TPRM</SelectItem>
              <SelectItem value="INTERNAL_AUDIT">Internal Audit</SelectItem>
              <SelectItem value="TECHNICAL_EVIDENCE">Technical Evidence</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Subscriptions table */}
      <Card>
        <CardHeader className="border-b border-stone-200 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t("Subscriptions")} <span className="text-stone-500 font-normal">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-stone-600">{t("Loading…")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-stone-600">{t("No subscriptions match the current filters.")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("Organization")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Modules")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Type")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("MRR")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Next renewal")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Status")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.subscriptionId} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-900">{r.customerName}</div>
                      <div className="text-xs text-stone-500 font-mono">{r.customerCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.modules.length === 0 ? (
                          <span className="text-stone-500 text-xs">{t("None")}</span>
                        ) : (
                          r.modules.map((m) => (
                            <Badge
                              key={m.moduleCode}
                              variant="outline"
                              className={m.cancelledAt ? "opacity-50 line-through" : ""}
                              title={`${m.tier} · ${m.billingCycle} · ₹${formatINR(m.unitPrice)} · ends ${formatDate(m.cycleEnd)}`}
                            >
                              {m.moduleCode === "INTERNAL_AUDIT" ? "IA" : m.moduleCode === "TECHNICAL_EVIDENCE" ? "TE" : m.moduleCode} · {m.tier[0]}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={TYPE_BADGE[r.subscriptionType]}>
                        {r.subscriptionType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-stone-900">
                      {r.subscriptionType === "PAID" ? `₹${formatINR(r.mrr)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-stone-700 whitespace-nowrap">
                      {formatDate(r.nextRenewal)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_BADGE[r.status]}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/subscription/list/${r.subscriptionId}`}>
                        <Button variant="outline" size="sm">{t("View")}</Button>
                      </Link>
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

function KpiCard({
  icon, label, value, accent = false, warning = false, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  let cls = "bg-white";
  if (accent) cls = "bg-amber-50 border-amber-200";
  else if (warning) cls = "bg-amber-50 border-amber-200";
  else if (danger) cls = "bg-red-50 border-red-200";
  return (
    <Card className={cls}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-stone-600">
          {icon}
          {label}
        </div>
        <div className="text-xl font-semibold text-stone-900 mt-1 font-mono">{value}</div>
      </CardContent>
    </Card>
  );
}
