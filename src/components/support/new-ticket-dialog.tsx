"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { triggerTranslation } from "@/hooks/useTranslatedData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { PRIORITY_OPTIONS } from "./ticket-meta";

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewTicketDialog({ open, onOpenChange, onCreated }: NewTicketDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<string>("auto");

  function reset() {
    setSubject("");
    setDescription("");
    setCategory("");
    setPriority("auto");
  }

  async function handleSubmit() {
    if (!subject.trim()) {
      toast({ title: t("Subject is required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          priority: priority === "auto" ? undefined : priority,
          channel: "InApp",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create ticket");
      }
      const ticket = await res.json();
      // Trigger dynamic translation for the entered text (create-time only).
      triggerTranslation("SupportTicket", ticket.id, {
        subject: ticket.subject,
        description: ticket.description || "",
      });
      toast({ title: t("Ticket created"), description: ticket.ticketCode });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({
        title: t("Failed to create ticket"),
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("New Support Ticket")}</DialogTitle>
          <DialogDescription>
            {t("Priority and tier are auto-assigned, but you can override the priority.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t("Subject")} *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("Brief summary of the issue")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("Description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={t("Describe the issue in detail")}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("Category")}</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("e.g. PMS, OTA, Billing")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t("Auto")}</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Create Ticket")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
