"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Search, Clock, AlertCircle } from "lucide-react";
import { NewTicketDialog } from "./new-ticket-dialog";
import {
  PriorityBadge,
  StatusBadge,
  TierBadge,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  TIER_OPTIONS,
  slaState,
} from "./ticket-meta";

interface TicketRow {
  id: string;
  ticketCode: string;
  subject: string;
  priority: string;
  tier: string;
  status: string;
  channel: string;
  category: string | null;
  slaResolveDeadline: string | null;
  resolvedAt: string | null;
  createdAt: string;
  assignedTo: { id: string; fullName: string } | null;
  reporter: { id: string; fullName: string } | null;
}

export function TicketsView({ consoleMode = false }: { consoleMode?: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { canCreate } = usePermissions("support.tickets");

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [queue, setQueue] = useState(consoleMode ? "mine" : "all");
  const [createOpen, setCreateOpen] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (tierFilter !== "all") params.set("tier", tierFilter);
      if (queue !== "all") params.set("queue", queue);
      params.set("pageSize", "50");
      const res = await fetch(`/api/support/tickets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, tierFilter, queue]);

  useEffect(() => {
    const id = setTimeout(fetchTickets, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [fetchTickets, search]);

  // Translate subjects for display (read-only — fetches existing translations).
  const { data: translated } = useTranslatedData(tickets, { modelName: "SupportTicket" });
  const rows = translated || tickets;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Search tickets")}
            className="ltr:pl-8 rtl:pr-8"
          />
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="ltr:mr-2 rtl:ml-2 h-4 w-4" />
            {t("New Ticket")}
          </Button>
        )}
      </div>

      {consoleMode && (
        <Tabs value={queue} onValueChange={setQueue}>
          <TabsList>
            <TabsTrigger value="mine">{t("My Queue")}</TabsTrigger>
            <TabsTrigger value="unassigned">{t("Unassigned")}</TabsTrigger>
            <TabsTrigger value="open">{t("Open")}</TabsTrigger>
            <TabsTrigger value="all">{t("All")}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder={t("Status")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Statuses")}</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder={t("Priority")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Priorities")}</SelectItem>
            {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder={t("Tier")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("All Tiers")}</SelectItem>
            {TIER_OPTIONS.map((tier) => <SelectItem key={tier} value={tier}>{tier}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Code")}</TableHead>
              <TableHead>{t("Subject")}</TableHead>
              <TableHead>{t("Priority")}</TableHead>
              <TableHead>{t("Tier")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead>{t("Assignee")}</TableHead>
              <TableHead>{t("SLA")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {t("No tickets found")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((ticket: TicketRow) => {
                const sla = slaState(ticket.slaResolveDeadline, ticket.resolvedAt);
                return (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/support/tickets/${ticket.id}`)}
                  >
                    <TableCell className="font-mono text-xs">{ticket.ticketCode}</TableCell>
                    <TableCell className="max-w-xs truncate font-medium">{ticket.subject}</TableCell>
                    <TableCell><PriorityBadge value={ticket.priority} /></TableCell>
                    <TableCell><TierBadge value={ticket.tier} /></TableCell>
                    <TableCell><StatusBadge value={ticket.status} label={t(ticket.status)} /></TableCell>
                    <TableCell className="text-sm">
                      {ticket.assignedTo?.fullName || <span className="text-muted-foreground">{t("Unassigned")}</span>}
                    </TableCell>
                    <TableCell>
                      {sla === "breached" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                          <AlertCircle className="h-3.5 w-3.5" /> {t("Breached")}
                        </span>
                      ) : sla === "soon" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Clock className="h-3.5 w-3.5" /> {t("Due soon")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <NewTicketDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchTickets} />
    </div>
  );
}
