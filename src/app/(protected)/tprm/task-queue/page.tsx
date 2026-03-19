"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
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
import { Loader2, Eye, RotateCcw, UserPlus, Home, ChevronRight, Trash2, Clock, Play } from "lucide-react";
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

interface ScheduledTask {
  id: string;
  queueId: string;
  name: string;
  taskFunction: string;
  description: string | null;
  schedule: string | null;
  status: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  isActive: boolean;
  createdAt: string;
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
  const { data: session } = useSession();
  const isGRCAdmin = session?.user?.roles?.includes("GRCAdministrator");
  const [activeTab, setActiveTab] = useState("unassigned");
  const [items, setItems] = useState<TaskQueueItem[]>([]);
  const { data: translatedItems } = useTranslatedData(items, { modelName: 'TPRMAssessment' });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("all");

  // System scheduled tasks (for GRCAdministrator)
  const [systemTasks, setSystemTasks] = useState<ScheduledTask[]>([]);
  const [systemLoading, setSystemLoading] = useState(true);

  const fetchSystemTasks = useCallback(async () => {
    try {
      setSystemLoading(true);
      const res = await fetch("/api/system/task-queue");
      if (res.ok) {
        const data = await res.json();
        setSystemTasks(data);
      }
    } catch (error) {
      console.error("Error fetching system tasks:", error);
    } finally {
      setSystemLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isGRCAdmin) {
      fetchSystemTasks();
    }
  }, [isGRCAdmin, fetchSystemTasks]);

  const handleDeleteSystemTask = async (taskId: string) => {
    try {
      const res = await fetch("/api/system/task-queue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId }),
      });
      if (res.ok) {
        toast({ title: t("Task deleted successfully") });
        fetchSystemTasks();
      } else {
        toast({ title: t("Failed to delete task"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("Failed to delete task"), variant: "destructive" });
    }
  };

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
      cell: ({ row }) => t(row.getValue("assessmentType")),
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
      cell: ({ row }) => t(row.getValue("assessmentType")),
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

  // System scheduled task columns (for GRCAdministrator)
  const systemColumns: ColumnDef<ScheduledTask>[] = [
    {
      accessorKey: "queueId",
      header: t("Queue ID"),
      cell: ({ row }) => <span className="font-mono text-xs text-slate-500 truncate max-w-[180px] inline-block">{row.getValue("queueId")}</span>,
    },
    {
      accessorKey: "name",
      header: t("Name"),
      cell: ({ row }) => <span className="text-sm">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "taskFunction",
      header: t("Function"),
      cell: ({ row }) => <span className="text-sm font-medium text-primary-700">{row.getValue("taskFunction")}</span>,
    },
    {
      accessorKey: "schedule",
      header: t("Schedule"),
      cell: ({ row }) => (
        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{row.getValue("schedule") || "-"}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("Created Date"),
      cell: ({ row }) => formatDate(row.getValue("createdAt")),
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const variant = status === "Running" ? "secondary" : status === "Failed" ? "destructive" : status === "Completed" ? "default" : "outline";
        return <Badge variant={variant}>{t(status)}</Badge>;
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
          onClick={() => handleDeleteSystemTask(row.original.id)}
          title={t("Delete")}
        >
          <Trash2 className="h-4 w-4" />
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
    <div className="flex items-center gap-2 rtl:flex-row-reverse">
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
        data={translatedItems}
        searchPlaceholder={t("Search...")}
        toolbarExtra={activeTab === "returned" ? returnedFilterToolbar : dateFilterToolbar}
      />
    );
  };

  // GRCAdministrator sees system scheduled tasks
  if (isGRCAdmin) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("TPRM")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Task Queue")}</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Task Queue")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("System scheduled tasks and background jobs")}</p>
          </div>
        </div>

        {systemLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataGrid
            columns={systemColumns}
            data={systemTasks}
            searchPlaceholder={t("Search tasks...")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("TPRM")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Task Queue")}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Task Queue")}</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="ltr:justify-start rtl:justify-end">
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
