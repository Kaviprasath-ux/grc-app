"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Settings2, Plus, Trash2, Loader2 } from "lucide-react";
import { PRIORITY_OPTIONS, TIER_OPTIONS } from "@/components/support/ticket-meta";

interface Rule {
  id: string;
  category: string;
  defaultTier: string;
  defaultPriority: string;
  keywords: string | null;
  isActive: boolean;
}

export default function SupportSettingsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canView, canCreate, canEdit, canDelete, isLoading } = usePermissions("support.settings");

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState("L1");
  const [priority, setPriority] = useState("P3");
  const [keywords, setKeywords] = useState("");

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/support/routing-rules");
    if (res.ok) setRules((await res.json()).rules || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canView) fetchRules();
  }, [canView, fetchRules]);

  async function createRule() {
    if (!category.trim()) {
      toast({ title: t("Category is required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/support/routing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: category.trim(), defaultTier: tier, defaultPriority: priority, keywords }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      toast({ title: t("Routing rule created") });
      setOpen(false);
      setCategory(""); setTier("L1"); setPriority("P3"); setKeywords("");
      fetchRules();
    } catch (e) {
      toast({ title: t("Failed to create rule"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: Rule) {
    await fetch(`/api/support/routing-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    fetchRules();
  }

  async function remove(rule: Rule) {
    await fetch(`/api/support/routing-rules/${rule.id}`, { method: "DELETE" });
    fetchRules();
  }

  if (isLoading) return null;
  if (!canView) return <Unauthorized />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t("Support Settings")}</h1>
            <p className="text-sm text-muted-foreground">{t("Routing rules — auto-assign tier and priority by category")}</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="ltr:mr-2 rtl:ml-2 h-4 w-4" /> {t("Add Rule")}
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Category")}</TableHead>
              <TableHead>{t("Default Tier")}</TableHead>
              <TableHead>{t("Default Priority")}</TableHead>
              <TableHead>{t("P1 Keywords")}</TableHead>
              <TableHead>{t("Active")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : rules.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{t("No routing rules yet")}</TableCell></TableRow>
            ) : (
              rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.category}</TableCell>
                  <TableCell>{r.defaultTier}</TableCell>
                  <TableCell>{r.defaultPriority}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.keywords || "—"}</TableCell>
                  <TableCell>
                    <Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} disabled={!canEdit} />
                  </TableCell>
                  <TableCell>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => remove(r)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Routing Rule")}</DialogTitle>
            <DialogDescription>{t("New tickets in this category get this tier and priority by default.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Category")} *</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("e.g. PMS, OTA, Billing")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Default Tier")}</Label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIER_OPTIONS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Default Priority")}</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("P1 Keywords")}</Label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("comma,separated,keywords")} />
              <p className="text-xs text-muted-foreground">{t("Tickets matching any keyword are forced to P1.")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("Cancel")}</Button>
            <Button onClick={createRule} disabled={saving}>
              {saving && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
              {t("Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
