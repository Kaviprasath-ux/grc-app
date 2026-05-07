"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Home, ChevronRight, Calendar, Sparkles, RotateCcw, Ban, RefreshCcw, FileText, IndianRupee,
  AlertTriangle, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
type SubscriptionType = "PAID" | "TRIAL" | "COMPLIMENTARY";
type ModuleCode = "GRC" | "TPRM" | "INTERNAL_AUDIT";
type PlanTier = "BASIC" | "MEDIUM" | "PRO";

interface ModuleDetail {
  id: string;
  moduleCode: ModuleCode;
  tier: PlanTier;
  billingCycle: "MONTHLY" | "YEARLY";
  unitPrice: number;
  userLimit: number;
  vendorLimit: number | null;
  assessmentLimit: number | null;
  frameworkLimit: number | null;
  auditLimit: number | null;
  cycleStart: string;
  cycleEnd: string;
  cancelledAt: string | null;
  previousTier: PlanTier | null;
  tierChangedAt: string | null;
  status: SubscriptionStatus;
}

interface SubscriptionDetail {
  id: string;
  customerAccount: { id: string; code: string; name: string };
  subscriptionType: SubscriptionType;
  status: SubscriptionStatus;
  autoRenew: boolean;
  trialEndsAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  modules: ModuleDetail[];
  invoices: Array<{ id: string; invoiceNumber: string; total: number; status: string; issueDate: string }>;
  payments: Array<{ id: string; amount: number; status: string; provider: string; paidAt: string | null }>;
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

function formatINR(n: number) { return n.toLocaleString("en-IN"); }
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  const { toast } = useToast();

  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [extendDialog, setExtendDialog] = useState(false);
  const [extendDays, setExtendDays] = useState<number>(30);
  const [extendModule, setExtendModule] = useState<ModuleCode | "ALL">("ALL");
  const [compDialog, setCompDialog] = useState<"grant" | "revoke" | null>(null);
  const [compReason, setCompReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<ModuleCode | "ALL" | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await fetch(`/api/grc/subscriptions/${id}`);
    const json = await res.json();
    if (!res.ok) {
      toast({ variant: "destructive", title: t("Load failed"), description: json.error });
      return;
    }
    setSub(json.data);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/grc/subscriptions/${id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) setSub(json.data);
      } catch (e) {
        toast({ variant: "destructive", title: t("Load failed"), description: (e as Error).message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, toast, t]);

  async function doExtend() {
    if (extendDays < 1) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/grc/subscriptions/${id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: extendDays,
          ...(extendModule !== "ALL" && { moduleCode: extendModule }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Extend failed");
      setExtendDialog(false);
      toast({ title: t("Extended"), description: t(`${json.extended} module(s) extended by ${extendDays} days`) });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: t("Extend failed"), description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/grc/subscriptions/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cancelTarget === "ALL" ? {} : { moduleCode: cancelTarget }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cancel failed");
      setCancelTarget(null);
      toast({ title: t("Cancelled"), description: t(`${json.cancelled} module(s)`) });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: t("Cancel failed"), description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function doReenable(moduleCode?: ModuleCode) {
    setBusy(true);
    try {
      const res = await fetch(`/api/grc/subscriptions/${id}/reenable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moduleCode ? { moduleCode } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Re-enable failed");
      toast({ title: t("Re-enabled"), description: t(`${json.reenabled} module(s)`) });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: t("Re-enable failed"), description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function doComplimentary(grant: boolean) {
    setBusy(true);
    try {
      const newType: SubscriptionType = grant ? "COMPLIMENTARY" : "PAID";
      const noteTransition = grant ? `Granted complimentary access. Reason: ${compReason || "(unspecified)"}` : "Revoked complimentary";
      const existingNotes = sub?.notes ?? "";
      const stamp = new Date().toISOString();
      const newNotes = `${existingNotes ? existingNotes + "\n" : ""}[${stamp}] ${noteTransition}`;
      const res = await fetch(`/api/grc/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionType: newType, notes: newNotes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setCompDialog(null);
      setCompReason("");
      toast({ title: grant ? t("Granted complimentary access") : t("Revoked complimentary") });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: t("Update failed"), description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleAutoRenew() {
    if (!sub) return;
    try {
      const res = await fetch(`/api/grc/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: !sub.autoRenew }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Update failed");
      }
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: t("Update failed"), description: (e as Error).message });
    }
  }

  if (loading) return <div className="p-8 text-stone-600">{t("Loading…")}</div>;
  if (!sub) return <div className="p-8 text-red-600">{t("Subscription not found")}</div>;

  const isComp = sub.subscriptionType === "COMPLIMENTARY";

  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/grc" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />{t("GRC Admin")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/subscription/list" className="hover:text-stone-900">{t("All Subscriptions")}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{sub.customerAccount.name}</span>
      </nav>

      {/* Header card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">{sub.customerAccount.name}</h1>
              <div className="text-stone-500 font-mono text-sm">{sub.customerAccount.code}</div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className={STATUS_BADGE[sub.status]}>
                  {sub.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={TYPE_BADGE[sub.subscriptionType]}>
                  {sub.subscriptionType}
                </Badge>
                {sub.autoRenew && <Badge variant="outline">Auto-renew on</Badge>}
              </div>
            </div>

            {/* Action toolbar */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setExtendDialog(true)} disabled={isComp}>
                <Calendar className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("Extend")}
              </Button>
              <Button variant="outline" onClick={toggleAutoRenew} disabled={isComp}>
                <RefreshCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {sub.autoRenew ? t("Disable auto-renew") : t("Enable auto-renew")}
              </Button>
              <Button variant="outline" onClick={() => doReenable()} disabled={busy}>
                <RotateCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("Re-enable all")}
              </Button>
              {isComp ? (
                <Button variant="outline" onClick={() => setCompDialog("revoke")}>
                  {t("Revoke Complimentary")}
                </Button>
              ) : (
                <Button onClick={() => setCompDialog("grant")} className="bg-purple-600 hover:bg-purple-700">
                  <Sparkles className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                  {t("Grant Complimentary")}
                </Button>
              )}
              <Button variant="outline" onClick={() => setCancelTarget("ALL")} className="text-red-600">
                <Ban className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                {t("Cancel all")}
              </Button>
            </div>
          </div>

          {isComp && (
            <div className="mt-4 rounded-md bg-purple-50 border border-purple-200 p-3 flex gap-2 text-sm text-purple-900">
              <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>{t("This subscription is complimentary — no invoices, no expiry alerts, full access to all listed modules.")}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modules table */}
      <Card>
        <CardHeader className="border-b border-stone-200 py-3">
          <CardTitle className="text-base">{t("Modules")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sub.modules.length === 0 ? (
            <div className="p-8 text-center text-stone-600">{t("No modules subscribed")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("Module")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Tier")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Cycle")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("Unit price")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Limits")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Cycle ends")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Status")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sub.modules.map((m) => (
                  <tr key={m.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium">{m.moduleCode === "INTERNAL_AUDIT" ? "Internal Audit" : m.moduleCode}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{m.tier}</Badge>
                      {m.previousTier && <span className="text-xs text-stone-500 ltr:ml-2 rtl:mr-2">(was {m.previousTier})</span>}
                    </td>
                    <td className="px-4 py-3">{m.billingCycle}</td>
                    <td className="px-4 py-3 text-right font-mono">₹{formatINR(m.unitPrice)}</td>
                    <td className="px-4 py-3 text-xs text-stone-600 whitespace-nowrap">
                      {t("Users")}: {m.userLimit}
                      {m.frameworkLimit !== null && ` · ${t("Frwks")}: ${m.frameworkLimit ?? "∞"}`}
                      {m.vendorLimit !== null && ` · ${t("Vendors")}: ${m.vendorLimit ?? "∞"}`}
                      {m.assessmentLimit !== null && ` · ${t("Assess")}: ${m.assessmentLimit ?? "∞"}`}
                      {m.auditLimit !== null && ` · ${t("Audits")}: ${m.auditLimit ?? "∞"}`}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(m.cycleEnd)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={STATUS_BADGE[m.status]}>
                        {m.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {!m.cancelledAt ? (
                          <Button size="sm" variant="ghost" onClick={() => setCancelTarget(m.moduleCode)} disabled={isComp}>
                            <Ban className="h-3 w-3 text-red-600" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => doReenable(m.moduleCode)}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="border-b border-stone-200 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("Invoices")} ({sub.invoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sub.invoices.length === 0 ? (
            <div className="p-6 text-center text-stone-600 text-sm">{t("No invoices yet")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-700">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t("Invoice #")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("Date")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Total")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {sub.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-stone-100">
                    <td className="px-4 py-2 font-mono">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2">{formatDate(inv.issueDate)}</td>
                    <td className="px-4 py-2 text-right font-mono">₹{formatINR(inv.total)}</td>
                    <td className="px-4 py-2"><Badge variant="outline">{inv.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Audit notes */}
      <Card>
        <CardHeader className="border-b border-stone-200 py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            {t("Audit notes")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <pre className="text-xs text-stone-700 whitespace-pre-wrap font-mono leading-relaxed">
            {sub.notes || t("(no notes)")}
          </pre>
        </CardContent>
      </Card>

      {/* Extend dialog */}
      <Dialog open={extendDialog} onOpenChange={setExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Extend Subscription")}</DialogTitle>
            <DialogDescription>
              {t("Push cycleEnd forward by N days. Used for free trial extensions or support credit. Audit-logged.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Days to add")}</Label>
              <Input
                type="number" min={1} max={3650}
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div>
              <Label>{t("Apply to")}</Label>
              <Select value={extendModule} onValueChange={(v) => setExtendModule(v as ModuleCode | "ALL")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("All modules")}</SelectItem>
                  {sub.modules.map((m) => (
                    <SelectItem key={m.id} value={m.moduleCode}>{m.moduleCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialog(false)} disabled={busy}>{t("Cancel")}</Button>
            <Button onClick={doExtend} disabled={busy}>{busy ? t("Saving…") : t("Extend")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complimentary dialog */}
      <Dialog open={!!compDialog} onOpenChange={(o) => !o && setCompDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {compDialog === "grant" ? t("Grant Complimentary Access") : t("Revoke Complimentary")}
            </DialogTitle>
            <DialogDescription>
              {compDialog === "grant"
                ? t("Customer keeps full access to all current modules at no charge. Invoices and expiry alerts are skipped. Reversible at any time.")
                : t("Subscription returns to PAID. The customer will receive expiry alerts and need to renew at cycleEnd.")}
            </DialogDescription>
          </DialogHeader>
          {compDialog === "grant" && (
            <div>
              <Label>{t("Reason")}</Label>
              <Textarea
                rows={3}
                placeholder={t("e.g., Strategic partner, Internal demo customer, Beta tester")}
                value={compReason}
                onChange={(e) => setCompReason(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompDialog(null)} disabled={busy}>{t("Cancel")}</Button>
            <Button
              onClick={() => doComplimentary(compDialog === "grant")}
              className={compDialog === "grant" ? "bg-purple-600 hover:bg-purple-700" : ""}
              disabled={busy}
            >
              {busy ? t("Saving…") : compDialog === "grant" ? t("Grant") : t("Revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {t("Cancel")} {cancelTarget === "ALL" ? t("all modules") : cancelTarget}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("Customer keeps access until cycleEnd. Auto-renew turns off. Reversible via Re-enable.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("Keep")}</AlertDialogCancel>
            <AlertDialogAction onClick={doCancel} className="bg-red-600 hover:bg-red-700" disabled={busy}>
              {t("Cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
