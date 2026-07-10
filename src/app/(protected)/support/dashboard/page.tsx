"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2, Ticket, Clock, AlertCircle, Smile, Bot } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Metrics {
  totals: { total: number; open: number; resolved: number };
  byPriority: Record<string, number>;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
  avgFirstResponseMins: number | null;
  avgResolutionMins: number | null;
  slaBreaches: number;
  slaCompliancePct: number | null;
  csat: { average: number | null; responses: number };
  chatbotEscalations: number;
}

const PRIORITY_COLORS: Record<string, string> = { P1: "#dc2626", P2: "#ea580c", P3: "#2563eb", P4: "#64748b" };

function fmtMins(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function SupportDashboardPage() {
  const { t } = useLanguage();
  const { canView, isLoading } = usePermissions("support.dashboard");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) return;
    fetch("/api/support/metrics?days=90")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetrics(d))
      .finally(() => setLoading(false));
  }, [canView]);

  if (isLoading) return null;
  if (!canView) return <Unauthorized />;

  const priorityData = metrics ? Object.entries(metrics.byPriority).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("Support Dashboard")}</h1>
          <p className="text-sm text-muted-foreground">{t("Last 90 days")}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !metrics ? (
        <p className="text-muted-foreground">{t("No data available")}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<Ticket className="h-5 w-5" />} label={t("Open tickets")} value={`${metrics.totals.open}`} sub={`${metrics.totals.total} ${t("total")}`} />
            <Kpi icon={<Clock className="h-5 w-5" />} label={t("Avg first response")} value={fmtMins(metrics.avgFirstResponseMins)} sub={`${t("Resolution")}: ${fmtMins(metrics.avgResolutionMins)}`} />
            <Kpi icon={<AlertCircle className="h-5 w-5" />} label={t("SLA compliance")} value={metrics.slaCompliancePct != null ? `${metrics.slaCompliancePct}%` : "—"} sub={`${metrics.slaBreaches} ${t("breaches")}`} />
            <Kpi icon={<Smile className="h-5 w-5" />} label={t("CSAT")} value={metrics.csat.average != null ? `${metrics.csat.average}/5` : "—"} sub={`${metrics.csat.responses} ${t("responses")}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("Tickets by priority")}</CardTitle></CardHeader>
              <CardContent>
                {priorityData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("No tickets yet")}</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={priorityData}>
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value">
                        {priorityData.map((d) => <Cell key={d.name} fill={PRIORITY_COLORS[d.name] || "#2563eb"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> {t("Channels & tiers")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Distribution label={t("By tier")} data={metrics.byTier} />
                <Distribution label={t("By channel")} data={metrics.byChannel} />
                <Distribution label={t("By status")} data={metrics.byStatus} />
                <p className="pt-2 text-xs text-muted-foreground">
                  {t("Chatbot escalations")}: <strong>{metrics.chatbotEscalations}</strong> — {t("questions the AI could not resolve")}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-sm">{label}</span></div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Distribution({ label, data }: { label: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {entries.length === 0 ? (
        <span className="text-xs text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map(([k, v]) => (
            <span key={k} className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs">{k}: <strong>{v}</strong></span>
          ))}
        </div>
      )}
    </div>
  );
}
