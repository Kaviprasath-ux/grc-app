"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface StrategicPlanRow {
  id: string;
  planCode: string;
  title: string;
  durationYears: number;
  startYear: number;
  status: string;
  _count?: { items: number };
}

const statusColor = (status: string): string => {
  switch (status) {
    case "Approved":
      return "bg-green-100 text-green-700";
    case "Pending Approval":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
};

export default function OperationalPlanListPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [plans, setPlans] = useState<StrategicPlanRow[]>([]);
  const [loading, setLoading] = useState(true);

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

      {/* Strategic plans as rows — click Edit to open the year-wise detail */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ltr:pl-5 rtl:pr-5">{t("Strategic Plan")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Duration")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audits")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
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
              ) : plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sm text-slate-400">
                    {t("No strategic plans yet. Create one in Strategic Plan first.")}
                  </TableCell>
                </TableRow>
              ) : (
                plans.map((p) => (
                  <TableRow
                    key={p.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                    onClick={() => open(p.id)}
                  >
                    <TableCell className="py-3 text-sm font-medium text-slate-800 ltr:pl-5 rtl:pr-5">{p.title}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{p.durationYears} {t("Years")}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{p._count?.items ?? 0}</TableCell>
                    <TableCell className="py-3">
                      <Badge className={statusColor(p.status)}>{t(p.status)}</Badge>
                    </TableCell>
                    <TableCell className="py-3 ltr:pr-5 rtl:pl-5 ltr:text-right rtl:text-left">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        title={t("Edit")}
                        onClick={(e) => {
                          e.stopPropagation();
                          open(p.id);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
