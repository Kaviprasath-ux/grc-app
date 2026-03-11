"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataGrid } from "@/components/shared/data-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, RotateCcw, UserPlus, Home, ChevronRight } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

interface TaskQueueItem {
  id: string;
  assessmentCode: string;
  assessmentType: string;
  status: string;
  vendorSubmissionDate: string | null;
  approverComment: string | null;
  vendor: { id: string; name: string; vendorCode: string; serviceCategory: string | null };
  initiatedBy: { id: string; fullName: string } | null;
  assessor: { id: string; fullName: string } | null;
  approver: { id: string; fullName: string } | null;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Completed":
    case "Approved":
      return "default";
    case "Rejected":
    case "Returned":
      return "destructive";
    case "In Progress":
    case "Under Review":
    case "Submitted":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export default function TaskQueuePage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("unassigned");
  const [items, setItems] = useState<TaskQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ tab: activeTab, limit: "200" });
      if (dateFrom) params.set("dateFrom", format(dateFrom, "yyyy-MM-dd"));
      if (dateTo) params.set("dateTo", format(dateTo, "yyyy-MM-dd"));
      if (activeTab === "returned" && statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const res = await fetch(`/api/tprm/task-queue?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data);
      }
    } catch (error) {
      console.error("Error fetching task queue:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset filters on tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setDateFrom(undefined);
    setDateTo(undefined);
    setStatusFilter("all");
  };

  // Claim handler
  const handleClaim = async (assessmentId: string) => {
    try {
      const res = await fetch("/api/tprm/task-queue/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast({ title: t("Error"), description: json.error || t("Failed to claim assessment"), variant: "destructive" });
        return;
      }
      toast({ title: t("Success"), description: t("Assessment claimed successfully") });
      fetchData();
    } catch {
      toast({ title: t("Error"), description: t("Failed to claim assessment"), variant: "destructive" });
    }
  };

  // Initiate reassessment handler
  const handleInitiateReassessment = (assessmentId: string) => {
    router.push(`/tprm/asr-assessments/${assessmentId}?from=task-queue`);
  };

  // Navigate to assessment detail
  const handleViewAssessment = (assessmentId: string) => {
    router.push(`/tprm/asr-assessments/${assessmentId}?from=task-queue`);
  };

  // Unassigned queue columns
  const unassignedColumns: ColumnDef<TaskQueueItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "assessmentType",
      header: t("Assessment Type"),
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Submission Date"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button variant="default" size="sm" onClick={() => handleClaim(row.original.id)}>
          <UserPlus className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Claim")}
        </Button>
      ),
    },
  ];

  // My Queue columns
  const myQueueColumns: ColumnDef<TaskQueueItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "assessmentType",
      header: t("Assessment Type"),
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Submission Date"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleViewAssessment(row.original.id)} title={t("View")}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // Reassessment columns
  const reassessmentColumns: ColumnDef<TaskQueueItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "initiatedBy.fullName",
      header: t("Initiated By"),
      cell: ({ row }) => row.original.initiatedBy?.fullName || "-",
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Department"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "completionDate",
      header: t("Date"),
      cell: ({ row }) => formatDate(row.original.vendorSubmissionDate),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => handleInitiateReassessment(row.original.id)}>
          <RotateCcw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Initiate")}
        </Button>
      ),
    },
  ];

  // Returned columns
  const returnedColumns: ColumnDef<TaskQueueItem>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "vendor.serviceCategory",
      header: t("Service Category"),
      cell: ({ row }) => row.original.vendor?.serviceCategory || "-",
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.getValue("status"))}>{t(row.getValue("status"))}</Badge>
      ),
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Date of Submission"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      accessorKey: "approverComment",
      header: t("Approver Comment"),
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-[200px] inline-block">
          {row.getValue("approverComment") || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => handleViewAssessment(row.original.id)} title={t("View")}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const getColumns = () => {
    switch (activeTab) {
      case "unassigned":
        return unassignedColumns;
      case "my-queue":
        return myQueueColumns;
      case "reassessment":
        return reassessmentColumns;
      case "returned":
        return returnedColumns;
      default:
        return unassignedColumns;
    }
  };

  // Toolbar extra for date filters (non-returned tabs)
  const dateFilterToolbar = (
    <div className="flex items-center gap-2">
      <DatePicker
        value={dateFrom}
        onChange={(date) => setDateFrom(date)}
        placeholder={t("From")}
        className="w-[160px] h-9 text-sm"
      />
      <DatePicker
        value={dateTo}
        onChange={(date) => setDateTo(date)}
        placeholder={t("To")}
        className="w-[160px] h-9 text-sm"
      />
    </div>
  );

  // Toolbar extra for returned tab (status filter)
  const returnedFilterToolbar = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-[160px] h-9 border-slate-200 text-sm">
        <SelectValue placeholder={t("All Statuses")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("All Statuses")}</SelectItem>
        <SelectItem value="Returned">{t("Returned")}</SelectItem>
        <SelectItem value="Rejected">{t("Rejected")}</SelectItem>
      </SelectContent>
    </Select>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <DataGrid
        columns={getColumns()}
        data={items}
        searchPlaceholder={t("Search...")}
        toolbarExtra={activeTab === "returned" ? returnedFilterToolbar : dateFilterToolbar}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Task Queue")}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Task Queue")}</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="unassigned">{t("Unassigned")}</TabsTrigger>
          <TabsTrigger value="my-queue">{t("My Queue")}</TabsTrigger>
          <TabsTrigger value="reassessment">{t("Initiate Reassessment")}</TabsTrigger>
          <TabsTrigger value="returned">{t("Returned")}</TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned" className="mt-6">
          {renderContent()}
        </TabsContent>

        <TabsContent value="my-queue" className="mt-6">
          {renderContent()}
        </TabsContent>

        <TabsContent value="reassessment" className="mt-6">
          {renderContent()}
        </TabsContent>

        <TabsContent value="returned" className="mt-6">
          {renderContent()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
