"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataGrid } from "@/components/shared/data-grid";
import { Loader2, Home, ChevronRight } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

interface FactoryReport {
  id: string;
  date: string;
  name: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export default function AsrFactoryReportsPage() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<FactoryReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/asr-factory-reports?limit=200");
      if (res.ok) {
        const json = await res.json();
        setReports(json.data || []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: ColumnDef<FactoryReport>[] = [
    {
      accessorKey: "date",
      header: t("Date"),
      cell: ({ row }) => formatDate(row.getValue("date")),
    },
    {
      accessorKey: "name",
      header: t("Name"),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Assessment Factory Reports")}</span>
      </nav>

      <h1 className="text-2xl font-bold">{t("Assessment Factory Reports")}</h1>

      <DataGrid columns={columns} data={reports} />

      {reports.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {t("No reports available")}
        </div>
      )}
    </div>
  );
}
