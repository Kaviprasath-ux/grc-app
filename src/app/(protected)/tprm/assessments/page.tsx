"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData } from "@/hooks/useTranslatedData";
import { DataGrid } from "@/components/shared/data-grid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Eye, Download, RefreshCw, Home, ChevronRight, ChevronLeft, Inbox } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

interface Assessment {
  id: string;
  assessmentCode: string;
  assessmentType: string;
  status: string;
  assessmentResult: string | null;
  vendorSubmissionDate: string | null;
  assessorCompletionDate: string | null;
  approvalDate: string | null;
  completionDate: string | null;
  questionnaireTemplate: string | null;
  approverComment: string | null;
  vendor: { id: string; name: string; vendorCode: string; serviceCategory: string | null };
  initiatedBy: { id: string; fullName: string } | null;
  assessor: { id: string; fullName: string } | null;
  approver: { id: string; fullName: string } | null;
}

interface AssessmentLog {
  id: string;
  assessmentId: string;
  domainName: string | null;
  questionNo: string | null;
  questionTitle: string | null;
  logDate: string;
  logMessage: string | null;
  apiUrl: string | null;
  documentName: string | null;
}

interface LogGroup {
  assessment: { id: string; assessmentCode: string; vendorName: string };
  data: AssessmentLog[];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Completed":
    case "Approved":
      return "default";
    case "Rejected":
    case "Returned":
    case "Cancelled":
    case "Expired":
      return "destructive";
    case "In Progress":
    case "Under Review":
    case "Submitted":
      return "secondary";
    default:
      return "outline";
  }
}

function getResultVariant(result: string | null): "default" | "destructive" | "secondary" {
  switch (result) {
    case "Satisfactory":
      return "default";
    case "Unsatisfactory":
    case "Deficient":
      return "destructive";
    default:
      return "secondary";
  }
}

// ==================== Log Detail Dialog ====================

function LogDetailDialog({
  open,
  onOpenChange,
  logGroup,
  loading,
  onExport,
  onRefresh,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logGroup: LogGroup | null;
  loading: boolean;
  onExport: () => void;
  onRefresh: () => void;
  t: (key: string) => string;
}) {
  const [logPage, setLogPage] = useState(0);
  const LOGS_PER_PAGE = 10;

  const paginatedLogs = useMemo(() => {
    if (!logGroup?.data) return [];
    return logGroup.data.slice(logPage * LOGS_PER_PAGE, (logPage + 1) * LOGS_PER_PAGE);
  }, [logGroup, logPage]);

  const totalLogPages = logGroup?.data ? Math.ceil(logGroup.data.length / LOGS_PER_PAGE) : 0;
  const totalRows = logGroup?.data?.length || 0;
  const startRow = logPage * LOGS_PER_PAGE + 1;
  const endRow = Math.min((logPage + 1) * LOGS_PER_PAGE, totalRows);

  useEffect(() => { setLogPage(0); }, [logGroup?.assessment?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Fixed Header — Title (refresh icon) .............. [Export CSV] [X] */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 ltr:pr-8 rtl:pl-8">
              <div className="flex items-center gap-1.5 min-w-0">
                <DialogTitle className="text-lg font-semibold text-slate-800 truncate">
                  {logGroup
                    ? `${logGroup.assessment.assessmentCode} — ${logGroup.assessment.vendorName}`
                    : t("Assessment Logs")}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600 shrink-0"
                  onClick={onRefresh}
                  title={t("Refresh")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={onExport}
                disabled={!logGroup?.data?.length}
              >
                <Download className="h-3.5 w-3.5 ltr:mr-1.5 rtl:ml-1.5" />
                {t("Export CSV")}
              </Button>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                <p className="text-sm text-slate-500">{t("Loading logs...")}</p>
              </div>
            </div>
          ) : logGroup?.data?.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5 whitespace-nowrap">{t("Domain")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Question No")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Question Title")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Log Date")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap">{t("Log Message")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 whitespace-nowrap">{t("Document")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <TableCell className="py-3 text-sm text-slate-700 ps-5">{log.domainName || "-"}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 font-mono">{log.questionNo || "-"}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 max-w-[200px] truncate">{log.questionTitle || "-"}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{formatDate(log.logDate)}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 max-w-[200px] truncate">{log.logMessage || "-"}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700 pe-5">{log.documentName || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-3">
                <Inbox className="h-6 w-6 text-primary-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">{t("No logs found")}</p>
              <p className="text-xs text-slate-400">{t("This assessment has no activity logs yet")}</p>
            </div>
          )}
        </div>

        {/* Fixed Footer — pagination left, Close right */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex items-center justify-between">
          {totalRows > LOGS_PER_PAGE ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {startRow} {t("to")} {endRow} {t("of")} {totalRows}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setLogPage((p) => Math.max(0, p - 1))}
                  disabled={logPage === 0}
                >
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setLogPage((p) => Math.min(totalLogPages - 1, p + 1))}
                  disabled={logPage >= totalLogPages - 1}
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          ) : (
            <div />
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Page ====================

export default function AssessmentWorkspacePage() {
  const { t } = useLanguage();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Logs state
  const [selectedLogAssessment, setSelectedLogAssessment] = useState<LogGroup | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logStatusFilter, setLogStatusFilter] = useState("all");

  // Translation hooks — must be before any early returns
  const { data: translatedAssessments } = useTranslatedData(assessments, { modelName: 'TPRMAssessment' });

  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/assessments?limit=200");
      if (res.ok) {
        const json = await res.json();
        setAssessments(json.data);
      }
    } catch (error) {
      console.error("Error fetching assessments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleViewAssessment = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    setDialogOpen(true);
  };

  const handleViewLogs = async (assessment: Assessment) => {
    try {
      setLogsLoading(true);
      setLogDialogOpen(true);
      const res = await fetch(`/api/tprm/assessments/${assessment.id}/logs`);
      if (res.ok) {
        const json: LogGroup = await res.json();
        setSelectedLogAssessment(json);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRefreshLogs = async () => {
    if (!selectedLogAssessment) return;
    const a = assessments.find((x) => x.id === selectedLogAssessment.assessment.id);
    if (a) {
      try {
        setLogsLoading(true);
        const res = await fetch(`/api/tprm/assessments/${a.id}/logs`);
        if (res.ok) {
          const json: LogGroup = await res.json();
          setSelectedLogAssessment(json);
        }
      } catch (error) {
        console.error("Error refreshing logs:", error);
      } finally {
        setLogsLoading(false);
      }
    }
  };

  const handleExportLogs = () => {
    if (!selectedLogAssessment?.data?.length) return;
    const headers = [t("Domain Name"), t("Question No"), t("Question Title"), t("Log Date"), t("Log Message"), t("API URL"), t("Document Name")];
    const rows = selectedLogAssessment.data.map((log) => [
      log.domainName || "",
      log.questionNo || "",
      log.questionTitle || "",
      formatDate(log.logDate),
      log.logMessage || "",
      log.apiUrl || "",
      log.documentName || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assessment-logs-${selectedLogAssessment.assessment.assessmentCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(assessments.map((a) => a.status));
    return Array.from(statuses).sort();
  }, [assessments]);

  // Filtered assessments for logs tab
  const filteredLogAssessments = useMemo(() => {
    if (logStatusFilter === "all") return assessments;
    return assessments.filter((a) => a.status === logStatusFilter);
  }, [assessments, logStatusFilter]);

  // Assessment overview columns — matching Customer Admin pattern
  const overviewColumns: ColumnDef<Assessment>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "assessmentType",
      header: t("Type"),
      cell: ({ row }) => t(row.getValue("assessmentType")),
    },
    {
      accessorKey: "vendor.name",
      header: t("Vendor"),
      cell: ({ row }) => row.original.vendor?.name || "-",
    },
    {
      accessorKey: "vendorSubmissionDate",
      header: t("Vendor Submission Date"),
      cell: ({ row }) => formatDate(row.getValue("vendorSubmissionDate")),
    },
    {
      accessorKey: "status",
      header: t("Status"),
      cell: ({ row }) => (
        <Badge variant={getStatusVariant(row.getValue("status"))}>
          {t(row.getValue("status"))}
        </Badge>
      ),
    },
    {
      accessorKey: "completionDate",
      header: t("Completion Date"),
      cell: ({ row }) => formatDate(row.getValue("completionDate")),
    },
    {
      accessorKey: "assessmentResult",
      header: t("Assessment Result"),
      cell: ({ row }) => {
        const result = row.getValue("assessmentResult") as string | null;
        return result ? (
          <Badge variant={getResultVariant(result)}>{t(result)}</Badge>
        ) : (
          <span className="text-slate-400">-</span>
        );
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-600"
          onClick={() => handleViewAssessment(row.original)}
          title={t("View")}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // Assessment logs columns
  const logColumns: ColumnDef<Assessment>[] = [
    {
      accessorKey: "assessmentCode",
      header: t("ID"),
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("assessmentCode")}</span>,
    },
    {
      accessorKey: "assessmentType",
      header: t("Type"),
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
        <Badge variant={getStatusVariant(row.getValue("status"))}>
          {t(row.getValue("status"))}
        </Badge>
      ),
    },
    {
      accessorKey: "assessor",
      header: t("Assessor"),
      cell: ({ row }) => row.original.assessor?.fullName || "-",
    },
    {
      accessorKey: "completionDate",
      header: t("Completion Date"),
      cell: ({ row }) => formatDate(row.getValue("completionDate")),
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-slate-600"
          onClick={() => handleViewLogs(row.original)}
          title={t("View Logs")}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // Status filter dropdown for logs tab toolbar (rendered on the right side of DataGrid toolbar)
  const logToolbarExtra = (
    <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
      <SelectTrigger className="w-[160px] h-9 border-slate-200 text-sm">
        <SelectValue placeholder={t("All Statuses")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t("All Statuses")}</SelectItem>
        {uniqueStatuses.map((status) => (
          <SelectItem key={status} value={status}>{t(status)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("TPRM")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Assessment Workspace")}</span>
        </nav>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            <p className="text-sm text-slate-500">{t("Loading...")}</p>
          </div>
        </div>
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
        <span className="text-primary-700 font-medium">{t("Assessment Workspace")}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Assessment Workspace")}</h1>

      <Tabs defaultValue="overview">
        <TabsList className="ltr:justify-start rtl:justify-end">
          <TabsTrigger value="overview">{t("Assessment Overview")}</TabsTrigger>
          <TabsTrigger value="logs">{t("Assessment Logs")}</TabsTrigger>
        </TabsList>

        {/* Assessment Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <DataGrid
            columns={overviewColumns}
            data={translatedAssessments}
            searchPlaceholder={t("Search assessments...")}
            searchColumn="assessmentCode"
          />
        </TabsContent>

        {/* Assessment Logs Tab */}
        <TabsContent value="logs" className="mt-6">
          <DataGrid
            columns={logColumns}
            data={filteredLogAssessments}
            searchPlaceholder={t("Search by ID or vendor...")}
            searchColumn="assessmentCode"
            toolbarExtra={logToolbarExtra}
          />
        </TabsContent>
      </Tabs>

      {/* Assessment Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Assessment Detail")} — {selectedAssessment?.assessmentCode}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          {selectedAssessment && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Assessment ID")}</label>
                  <p className="font-mono text-sm text-slate-800">{selectedAssessment.assessmentCode}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Assessment Type")}</label>
                  <p className="text-sm text-slate-800">{t(selectedAssessment.assessmentType)}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Vendor")}</label>
                  <p className="text-sm text-slate-800">{selectedAssessment.vendor.name}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Status")}</label>
                  <div>
                    <Badge variant={getStatusVariant(selectedAssessment.status)}>
                      {t(selectedAssessment.status)}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Assessment Result")}</label>
                  <div>
                    {selectedAssessment.assessmentResult ? (
                      <Badge variant={getResultVariant(selectedAssessment.assessmentResult)}>
                        {t(selectedAssessment.assessmentResult)}
                      </Badge>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Questionnaire Template")}</label>
                  <p className="text-sm text-slate-800">{selectedAssessment.questionnaireTemplate || "-"}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Vendor Submission Date")}</label>
                  <p className="text-sm text-slate-800">{formatDate(selectedAssessment.vendorSubmissionDate)}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Assessor Completion Date")}</label>
                  <p className="text-sm text-slate-800">{formatDate(selectedAssessment.assessorCompletionDate)}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Approval Date")}</label>
                  <p className="text-sm text-slate-800">{formatDate(selectedAssessment.approvalDate)}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Completion Date")}</label>
                  <p className="text-sm text-slate-800">{formatDate(selectedAssessment.completionDate)}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Initiated By")}</label>
                  <p className="text-sm text-slate-800">{selectedAssessment.initiatedBy?.fullName || "-"}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Assessor")}</label>
                  <p className="text-sm text-slate-800">{selectedAssessment.assessor?.fullName || "-"}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{t("Approver")}</label>
                  <p className="text-sm text-slate-800">{selectedAssessment.approver?.fullName || "-"}</p>
                </div>
                {selectedAssessment.approverComment && (
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">{t("Approver Comment")}</label>
                    <p className="text-sm text-slate-800">{selectedAssessment.approverComment}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fixed Footer */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex ltr:justify-end rtl:justify-start">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              {t("Close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Detail Dialog */}
      <LogDetailDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        logGroup={selectedLogAssessment}
        loading={logsLoading}
        onExport={handleExportLogs}
        onRefresh={handleRefreshLogs}
        t={t}
      />
    </div>
  );
}
