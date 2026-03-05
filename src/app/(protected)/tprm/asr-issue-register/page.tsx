"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataGrid } from "@/components/shared/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Home, ChevronRight, Download } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

interface IssueRegisterEntry {
  id: string;
  department: string | null;
  businessOwner: string | null;
  vendor: string;
  vendorId: string;
  high: number;
  medium: number;
  low: number;
  total: number;
  status: string;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Open":
      return "secondary";
    case "Overdue":
      return "destructive";
    case "Closed":
      return "default";
    default:
      return "outline";
  }
}

export default function AsrIssueRegisterPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<IssueRegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/asr-issues?limit=200");
      if (res.ok) {
        const json = await res.json();
        setEntries(json.data || []);
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

  const filtered = useMemo(() => {
    let data = entries;
    if (vendorSearch) {
      const q = vendorSearch.toLowerCase();
      data = data.filter(
        (e) =>
          e.vendor?.toLowerCase().includes(q) ||
          e.vendorId?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      data = data.filter((e) => e.status === statusFilter);
    }
    return data;
  }, [entries, vendorSearch, statusFilter]);

  const handleExport = () => {
    const headers = ["Department", "Business Owner", "Vendor", "Vendor ID", "High", "Medium", "Low", "Total", "Status"];
    const rows = filtered.map((e) => [
      e.department || "",
      e.businessOwner || "",
      e.vendor,
      e.vendorId,
      e.high,
      e.medium,
      e.low,
      e.total,
      e.status,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "issue-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<IssueRegisterEntry>[] = [
    { accessorKey: "department", header: t("Department"), cell: ({ row }) => row.getValue("department") || "-" },
    { accessorKey: "businessOwner", header: t("Business Owner"), cell: ({ row }) => row.getValue("businessOwner") || "-" },
    {
      accessorKey: "vendor",
      header: t("Vendor"),
      cell: ({ row }) => (
        <button className="text-primary hover:underline font-medium">{row.getValue("vendor")}</button>
      ),
    },
    { accessorKey: "vendorId", header: t("Vendor ID") },
    {
      accessorKey: "high",
      header: t("High"),
      cell: ({ row }) => <span className="text-red-600 font-semibold">{row.getValue("high")}</span>,
    },
    {
      accessorKey: "medium",
      header: t("Medium"),
      cell: ({ row }) => <span className="text-orange-500 font-semibold">{row.getValue("medium")}</span>,
    },
    {
      accessorKey: "low",
      header: t("Low"),
      cell: ({ row }) => <span className="text-green-600 font-semibold">{row.getValue("low")}</span>,
    },
    {
      accessorKey: "total",
      header: t("Total"),
      cell: ({ row }) => <span className="font-bold">{row.getValue("total")}</span>,
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.getValue("status"))}>{row.getValue("status")}</Badge>
      ),
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
        <span className="text-primary-700 font-medium">{t("Issue Register")}</span>
      </nav>

      <h2 className="text-xl font-bold">{t("Issue Register")}</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder={t("Vendor Name")}
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
          />
        </div>
        <div className="w-[160px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder={t("Status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All")}</SelectItem>
              <SelectItem value="Open">{t("Open")}</SelectItem>
              <SelectItem value="Overdue">{t("Overdue")}</SelectItem>
              <SelectItem value="Closed">{t("Closed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Export")}
        </Button>
      </div>

      <DataGrid columns={columns} data={filtered} hideSearch />
    </div>
  );
}
