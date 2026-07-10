"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Loader2, Pencil, Trash2 } from "lucide-react";

interface Article {
  id: string;
  articleKey: string;
  module: string;
  category: string;
  productScope: string;
  roles: string[];
  question: string;
  answer: string | null;
  isPublished: boolean;
  source: string;
  updatedAt: string;
}

const MODULES = ["general", "compliance", "risk-management", "asset-management", "internal-audit", "tprm", "organization"];
const SCOPES = ["both", "grc", "audit", "tprm"];

export default function SupportKbPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { canView, canCreate, canEdit, canDelete, isLoading } = usePermissions("support.kb");

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState({ question: "", answer: "", module: "general", productScope: "both", isPublished: true });

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/support/kb?${params.toString()}`);
    if (res.ok) setArticles((await res.json()).articles || []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    if (canView) {
      const id = setTimeout(fetchArticles, search ? 300 : 0);
      return () => clearTimeout(id);
    }
  }, [canView, fetchArticles, search]);

  function openNew() {
    setEditing(null);
    setForm({ question: "", answer: "", module: "general", productScope: "both", isPublished: true });
    setOpen(true);
  }
  function openEdit(a: Article) {
    setEditing(a);
    setForm({ question: a.question, answer: a.answer || "", module: a.module, productScope: a.productScope, isPublished: a.isPublished });
    setOpen(true);
  }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ title: t("Question and answer are required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/support/kb/${editing.id}` : "/api/support/kb";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed");
      toast({ title: editing ? t("Article updated") : t("Article created") });
      setOpen(false);
      fetchArticles();
    } catch (e) {
      toast({ title: t("Save failed"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Article) {
    const res = await fetch(`/api/support/kb/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: t("Delete failed"), description: (await res.json().catch(() => ({}))).error, variant: "destructive" });
      return;
    }
    fetchArticles();
  }

  if (isLoading) return null;
  if (!canView) return <Unauthorized />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{t("Knowledge Base")}</h1>
            <p className="text-sm text-muted-foreground">{t("Help articles that power the AI concierge")}</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openNew}><Plus className="ltr:mr-2 rtl:ml-2 h-4 w-4" /> {t("New Article")}</Button>
        )}
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search articles")} className="max-w-xs" />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Question")}</TableHead>
              <TableHead>{t("Module")}</TableHead>
              <TableHead>{t("Scope")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead>{t("Source")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : articles.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{t("No articles yet")}</TableCell></TableRow>
            ) : (
              articles.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="max-w-md truncate font-medium">{a.question}</TableCell>
                  <TableCell className="text-xs">{a.module}</TableCell>
                  <TableCell className="text-xs uppercase">{a.productScope}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={a.isPublished ? "border-green-300 bg-green-50 text-green-700" : "border-slate-300 bg-slate-50 text-slate-600"}>
                      {a.isPublished ? t("Published") : t("Draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.source}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    {canEdit && <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>}
                    {canDelete && a.source === "manual" && (
                      <Button variant="ghost" size="sm" onClick={() => remove(a)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t("Edit Article") : t("New Article")}</DialogTitle>
            <DialogDescription>{t("Saving re-embeds the article so the AI picks it up immediately.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t("Question")} *</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder={t("e.g. How do I reset my password?")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Answer")} *</Label>
              <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={6} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Module")}</Label>
                <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Scope")}</Label>
                <Select value={form.productScope} onValueChange={(v) => setForm({ ...form, productScope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Status")}</Label>
                <Select value={form.isPublished ? "pub" : "draft"} onValueChange={(v) => setForm({ ...form, isPublished: v === "pub" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pub">{t("Published")}</SelectItem>
                    <SelectItem value="draft">{t("Draft")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("Cancel")}</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
              {t("Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
