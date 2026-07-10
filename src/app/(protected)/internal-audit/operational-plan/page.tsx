"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Loader2,
  Home,
  ChevronRight,
  CalendarClock,
  Pencil,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";

interface PlanItem {
  id: string;
  year: number;
  title: string;
  auditType: string | null;
  residualScore: number | null;
  riskLevel: string | null;
  priorityRank: number | null;
}

interface StrategicPlanRow {
  id: string;
  planCode: string;
  title: string;
  durationYears: number;
  startYear: number;
  status: string;
  items?: PlanItem[];
  _count?: { items: number };
}

export default function OperationalPlanListPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [plans, setPlans] = useState<StrategicPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic translation: overlay translated audit titles/types for the current locale.
  const allItems = useMemo(() => plans.flatMap((p) => p.items || []), [plans]);
  const { data: translatedItems } = useTranslatedData(allItems, { modelName: "AuditStrategicPlanItem" });
  const itemMap = useMemo(() => {
    const m = new Map<string, PlanItem>();
    translatedItems.forEach((it) => m.set(it.id, it));
    return m;
  }, [translatedItems]);
  const tItem = useCallback((it: PlanItem) => itemMap.get(it.id) ?? it, [itemMap]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/internal-audit/strategic-plans");
        if (!res.ok) throw new Error("Failed");
        setPlans(await res.json());
      } catch {
        toast.error(t("Failed to load strategic plans"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (id: string) => router.push(`/internal-audit/operational-plan/${id}`);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Operational Plan")}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-slate-700" />
          {t("Operational Audit Plan")}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("Year-wise audit plans derived from a Strategic Plan")}
        </p>
      </div>

      {/* Audits as rows (same layout as Strategic Plan) — Edit opens the year-wise detail */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 w-12 ltr:pl-5 rtl:pr-5">#</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audit")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Type")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Duration")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : (() => {
                const rows = plans.flatMap((p) => (p.items || []).map((it) => ({ it, plan: p })));
                if (rows.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-sm text-slate-400">
                        {t("No audits yet. Add audits from the Strategic Plan first.")}
                      </TableCell>
                    </TableRow>
                  );
                }
                return rows.map(({ it, plan }, idx) => {
                  const ti = tItem(it);
                  return (
                  <TableRow
                    key={it.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => open(plan.id)}
                  >
                    <TableCell className="py-3 text-sm text-slate-700 ltr:pl-5 rtl:pr-5">{idx + 1}</TableCell>
                    <TableCell className="py-3 text-sm font-medium text-slate-800">{ti.title}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{ti.auditType || "—"}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{plan.durationYears} {t("Years")}</TableCell>
                    <TableCell className="py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        title={t("Edit")}
                        onClick={(e) => {
                          e.stopPropagation();
                          open(plan.id);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
