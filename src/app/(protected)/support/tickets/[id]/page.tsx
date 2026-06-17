"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  ArrowUpCircle,
  MessageSquare,
  Bot,
  History,
} from "lucide-react";
import {
  PriorityBadge,
  StatusBadge,
  TierBadge,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TIER_OPTIONS,
} from "@/components/support/ticket-meta";

interface Comment {
  id: string;
  comment: string;
  isInternal: boolean;
  createdAt: string;
  user: { id: string; fullName: string } | null;
}
interface Activity {
  id: string;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
  actor: { id: string; fullName: string } | null;
}
interface Ticket {
  id: string;
  ticketCode: string;
  subject: string;
  description: string | null;
  priority: string;
  severity: string;
  tier: string;
  status: string;
  category: string | null;
  channel: string;
  escalationReason: string | null;
  botTranscript: string | null;
  createdAt: string;
  slaResolveDeadline: string | null;
  resolvedAt: string | null;
  assignedTo: { id: string; fullName: string } | null;
  reporter: { id: string; fullName: string } | null;
  reporterId: string | null;
  department: { id: string; name: string } | null;
  csatScore: number | null;
  csatSubmittedAt: string | null;
  comments: Comment[];
  activities: Activity[];
}
interface Agent {
  id: string;
  fullName: string;
  roles: string[];
}

export default function TicketDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id as string | undefined;
  const { canView, canEdit, isLoading: permLoading } = usePermissions("support.tickets");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchTicket = useCallback(async () => {
    const res = await fetch(`/api/support/tickets/${id}`);
    if (res.ok) setTicket(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTicket();
    fetch("/api/support/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d) => setAgents(d.agents || []))
      .catch(() => {});
  }, [fetchTicket]);

  async function patchTicket(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed");
      await fetchTicket();
    } catch (e) {
      toast({ title: t("Update failed"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function assign(assignedToId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: assignedToId === "none" ? null : assignedToId }),
      });
      if (!res.ok) throw new Error("Assign failed");
      await fetchTicket();
    } catch {
      toast({ title: t("Assign failed"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Escalate failed");
      toast({ title: t("Ticket escalated") });
      await fetchTicket();
    } catch (e) {
      toast({ title: t("Escalate failed"), description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function postComment() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim(), isInternal }),
      });
      if (!res.ok) throw new Error("Comment failed");
      setComment("");
      setIsInternal(false);
      await fetchTicket();
    } catch {
      toast({ title: t("Failed to add comment"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(score: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csatScore: score }),
      });
      if (!res.ok) throw new Error("Feedback failed");
      toast({ title: t("Thanks for your feedback") });
      await fetchTicket();
    } catch {
      toast({ title: t("Failed to submit feedback"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (permLoading || loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!canView) return <Unauthorized />;
  if (!ticket) return <div className="p-6 text-muted-foreground">{t("Ticket not found")}</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/support/console")}>
          <ArrowLeft className="ltr:mr-2 rtl:ml-2 h-4 w-4" /> {t("Back")}
        </Button>
        <span className="font-mono text-sm text-muted-foreground">{ticket.ticketCode}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge value={ticket.priority} />
                <TierBadge value={ticket.tier} />
                <StatusBadge value={ticket.status} label={t(ticket.status)} />
                {ticket.channel === "Chatbot" && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" /> {t("From chatbot")}
                  </span>
                )}
              </div>
              <CardTitle className="mt-2 text-xl">{ticket.subject}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.description && <p className="whitespace-pre-wrap text-sm text-foreground/90">{ticket.description}</p>}
              {ticket.botTranscript && (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("Chatbot transcript")}</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{ticket.botTranscript}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" /> {t("Conversation")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.comments.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("No replies yet")}</p>
              )}
              {ticket.comments.map((c) => (
                <div key={c.id} className={`rounded-md border p-3 ${c.isInternal ? "bg-amber-50 border-amber-200" : "bg-background"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{c.user?.fullName || t("Unknown")}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.isInternal ? t("Internal note") : t("Reply")} · {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.comment}</p>
                </div>
              ))}

              {canEdit && (
                <div className="space-y-2 pt-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder={t("Write a reply or internal note")}
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch checked={isInternal} onCheckedChange={setIsInternal} id="internal" />
                      <Label htmlFor="internal" className="text-sm">{t("Internal note")}</Label>
                    </div>
                    <Button onClick={postComment} disabled={busy || !comment.trim()}>
                      {busy && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
                      {t("Send")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Details")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label={t("Reporter")} value={ticket.reporter?.fullName || ticket.ticketCode} />
              <Field label={t("Channel")} value={ticket.channel} />
              <Field label={t("Category")} value={ticket.category || "—"} />
              <Field label={t("Department")} value={ticket.department?.name || "—"} />
              <Field label={t("Created")} value={new Date(ticket.createdAt).toLocaleString()} />
              {ticket.slaResolveDeadline && (
                <Field
                  label={t("Resolution SLA")}
                  value={
                    ticket.resolvedAt
                      ? t("Met")
                      : new Date(ticket.slaResolveDeadline) < new Date()
                        ? t("Breached")
                        : new Date(ticket.slaResolveDeadline).toLocaleString()
                  }
                />
              )}
              {ticket.escalationReason && <Field label={t("Escalation reason")} value={ticket.escalationReason} />}
              {ticket.csatScore != null && <Field label={t("Customer rating")} value={`${ticket.csatScore} / 5`} />}
            </CardContent>
          </Card>

          {/* CSAT capture — shown to the reporter once the ticket is resolved/closed */}
          {currentUserId === ticket.reporterId &&
            (ticket.status === "Resolved" || ticket.status === "Closed") &&
            ticket.csatScore == null && (
              <Card>
                <CardHeader><CardTitle className="text-base">{t("Rate this support")}</CardTitle></CardHeader>
                <CardContent>
                  <p className="mb-2 text-sm text-muted-foreground">{t("How satisfied were you with the resolution?")}</p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button key={n} variant="outline" size="sm" disabled={busy} onClick={() => submitFeedback(n)}>
                        {n}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {canEdit && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("Actions")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("Status")}</Label>
                  <Select value={ticket.status} onValueChange={(v) => patchTicket({ status: v })} disabled={busy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("Priority")}</Label>
                  <Select value={ticket.priority} onValueChange={(v) => patchTicket({ priority: v })} disabled={busy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("Tier")}</Label>
                  <Select value={ticket.tier} onValueChange={(v) => patchTicket({ tier: v })} disabled={busy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIER_OPTIONS.map((tier) => <SelectItem key={tier} value={tier}>{tier}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("Assignee")}</Label>
                  <Select value={ticket.assignedTo?.id || "none"} onValueChange={assign} disabled={busy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("Unassigned")}</SelectItem>
                      {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <Button variant="outline" className="w-full" onClick={escalate} disabled={busy || ticket.tier === "L4"}>
                  <ArrowUpCircle className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
                  {t("Escalate to next tier")}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" /> {t("Activity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {ticket.activities.length === 0 && <p className="text-sm text-muted-foreground">{t("No activity yet")}</p>}
              {ticket.activities.map((a) => (
                <div key={a.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{a.actor?.fullName || t("System")}</span>{" "}
                  {t(a.action.replace(/_/g, " "))}
                  {a.fromValue && a.toValue && <> : {a.fromValue} → {a.toValue}</>}
                  {a.note && <> — {a.note}</>}
                  <div className="text-[10px]">{new Date(a.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
