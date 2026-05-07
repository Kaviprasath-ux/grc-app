"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Home, ChevronRight, Plus, Trash2, Pencil, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

type PlanTier = "BASIC" | "MEDIUM" | "PRO";
type BillingCycle = "MONTHLY" | "YEARLY";
type DiscountType = "PERCENTAGE" | "FIXED";

interface BundleDiscount {
  id: string;
  name: string;
  minModules: number;
  minTier: PlanTier | null;
  discountType: DiscountType;
  discountValue: number;
  appliesToCycle: BillingCycle | null;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  id?: string;
  name: string;
  minModules: number;
  minTier: PlanTier | "ANY";
  discountType: DiscountType;
  discountValue: number;
  appliesToCycle: BillingCycle | "ANY";
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  minModules: 2,
  minTier: "ANY",
  discountType: "PERCENTAGE",
  discountValue: 10,
  appliesToCycle: "ANY",
  isActive: true,
  validFrom: "",
  validUntil: "",
};

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default function BundleDiscountsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [rows, setRows] = useState<BundleDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isEditing = !!form.id;

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/grc/bundle-discounts");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) setRows(json.data);
      } catch (e) {
        toast({ variant: "destructive", title: t("Load failed"), description: (e as Error).message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast, t]);

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(row: BundleDiscount) {
    setForm({
      id: row.id,
      name: row.name,
      minModules: row.minModules,
      minTier: row.minTier ?? "ANY",
      discountType: row.discountType,
      discountValue: row.discountValue,
      appliesToCycle: row.appliesToCycle ?? "ANY",
      isActive: row.isActive,
      validFrom: row.validFrom ? row.validFrom.slice(0, 10) : "",
      validUntil: row.validUntil ? row.validUntil.slice(0, 10) : "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: t("Name is required") });
      return;
    }
    if (form.discountType === "PERCENTAGE" && form.discountValue > 100) {
      toast({ variant: "destructive", title: t("Percentage cannot exceed 100") });
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      minModules: form.minModules,
      minTier: form.minTier === "ANY" ? null : form.minTier,
      discountType: form.discountType,
      discountValue: form.discountValue,
      appliesToCycle: form.appliesToCycle === "ANY" ? null : form.appliesToCycle,
      isActive: form.isActive,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
    };

    setSubmitting(true);
    try {
      const url = isEditing ? `/api/grc/bundle-discounts/${form.id}` : "/api/grc/bundle-discounts";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");

      if (isEditing) {
        setRows((prev) => prev.map((r) => (r.id === form.id ? json.data : r)));
      } else {
        setRows((prev) => [json.data, ...prev]);
      }
      setDialogOpen(false);
      toast({ title: isEditing ? t("Updated") : t("Created"), description: form.name });
    } catch (e) {
      toast({ variant: "destructive", title: t("Save failed"), description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: BundleDiscount) {
    try {
      const res = await fetch(`/api/grc/bundle-discounts/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setRows((prev) => prev.map((r) => (r.id === row.id ? json.data : r)));
    } catch (e) {
      toast({ variant: "destructive", title: t("Update failed"), description: (e as Error).message });
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/grc/bundle-discounts/${deleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Delete failed");
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      toast({ title: t("Deleted") });
    } catch (e) {
      toast({ variant: "destructive", title: t("Delete failed"), description: (e as Error).message });
    } finally {
      setDeleteId(null);
    }
  }

  // Live preview of discount in dialog
  const previewSubtotal = 200000;
  const previewDiscount = useMemo(() => {
    if (form.discountType === "PERCENTAGE") {
      return Math.round(previewSubtotal * (form.discountValue / 100));
    }
    return Math.min(form.discountValue, previewSubtotal);
  }, [form.discountType, form.discountValue]);

  return (
    <div className="space-y-6 p-6">
      <nav className="flex items-center gap-2 text-sm text-stone-600">
        <Link href="/grc" className="flex items-center gap-1 hover:text-stone-900">
          <Home className="h-4 w-4" />
          {t("GRC Admin")}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-stone-900 font-medium">{t("Bundle Discounts")}</span>
      </nav>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t("Bundle Discounts")}</h1>
          <p className="mt-1 text-stone-600 max-w-2xl">
            {t("Configure rules that automatically apply when customers select multiple modules. The best-matching active rule wins for each quote.")}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Create Rule")}
        </Button>
      </div>

      {loading ? (
        <div className="text-stone-600">{t("Loading…")}</div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-stone-600">
            <Tag className="h-12 w-12 mx-auto mb-3 text-stone-400" />
            <p className="font-medium">{t("No discount rules yet")}</p>
            <p className="text-sm mt-1">{t("Create one to offer multi-module customers a deal.")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("Name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Eligibility")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Discount")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Cycle")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Validity")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("Active")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-900">{row.name}</td>
                    <td className="px-4 py-3 text-stone-700">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">{row.minModules}+ {t("modules")}</Badge>
                        {row.minTier && <Badge variant="outline">{row.minTier}+</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-stone-900">
                      {row.discountType === "PERCENTAGE"
                        ? `${row.discountValue}%`
                        : `₹${formatINR(row.discountValue)}`}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{row.appliesToCycle ?? t("Any")}</td>
                    <td className="px-4 py-3 text-stone-700 whitespace-nowrap text-xs">
                      {row.validFrom || row.validUntil
                        ? `${formatDate(row.validFrom)} → ${formatDate(row.validUntil)}`
                        : t("Always")}
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={row.isActive} onCheckedChange={() => toggleActive(row)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(row.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? t("Edit Discount Rule") : t("Create Discount Rule")}</DialogTitle>
            <DialogDescription>
              {t("Defines when and how much discount applies to multi-module quotes.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>{t("Rule Name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("e.g. All-3 modules · 10% off · yearly")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Min modules")}</Label>
                <Select
                  value={String(form.minModules)}
                  onValueChange={(v) => setForm({ ...form, minModules: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3 (all)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t("Min tier")}</Label>
                <Select
                  value={form.minTier}
                  onValueChange={(v) => setForm({ ...form, minTier: v as FormState["minTier"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">{t("Any tier")}</SelectItem>
                    <SelectItem value="BASIC">Basic+</SelectItem>
                    <SelectItem value="MEDIUM">Medium+</SelectItem>
                    <SelectItem value="PRO">Pro only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Discount type")}</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) => setForm({ ...form, discountType: v as DiscountType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">{t("Percentage")} (%)</SelectItem>
                    <SelectItem value="FIXED">{t("Fixed")} (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>
                  {t("Value")} {form.discountType === "PERCENTAGE" ? "(%)" : "(₹)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                  className="font-mono"
                />
              </div>
            </div>

            <div>
              <Label>{t("Applies to cycle")}</Label>
              <Select
                value={form.appliesToCycle}
                onValueChange={(v) => setForm({ ...form, appliesToCycle: v as FormState["appliesToCycle"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">{t("Both monthly and yearly")}</SelectItem>
                  <SelectItem value="MONTHLY">{t("Monthly only")}</SelectItem>
                  <SelectItem value="YEARLY">{t("Yearly only")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Valid from")}</Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("Valid until")}</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                id="is-active"
              />
              <Label htmlFor="is-active">{t("Active")}</Label>
            </div>

            {/* Live preview */}
            <div className="rounded-md bg-stone-50 border border-stone-200 p-3 text-sm">
              <div className="flex justify-between text-stone-600">
                <span>{t("Preview on ₹2,00,000 subtotal")}:</span>
                <span className="font-mono">−₹{formatINR(previewDiscount)}</span>
              </div>
              <div className="flex justify-between font-medium text-stone-900 mt-1">
                <span>{t("After discount")}</span>
                <span className="font-mono">₹{formatINR(previewSubtotal - previewDiscount)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t("Saving…") : isEditing ? t("Save Changes") : t("Create Rule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete this discount rule?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This cannot be undone. Any in-progress quote that was using this rule will recompute without it.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
