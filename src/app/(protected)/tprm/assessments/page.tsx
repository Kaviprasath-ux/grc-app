"use client";

import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageHeader } from "@/components/shared/page-header";
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
import { Input } from "@/components/ui/input";
import { Loader2, Eye, Download, RefreshCw } from "lucide-react";
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

export default function AssessmentWorkspacePage() {
  const { t } = useLanguage();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Logs tab state
  const [logAssessments, setLogAssessments] = useState<Assessment[]>([]);
  const [selectedLogAssessment, setSelectedLogAssessment] = useState<LogGroup | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [logListOffset, setLogListOffset] = useState(0);
  const LOG_LIST_LIMIT = 20;

  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/assessments?limit=200");
      if (res.ok) {
        const json = await res.json();
        setAssessments(json.data);
        setLogAssessments(json.data);
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

  const handleSelectLogAssessment = async (assessment: Assessment) => {
    try {
      setLogsLoading(true);
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

  const handleExportLogs = () => {
    if (!selectedLogAssessment?.data?.length) return;
    const headers = ["Domain Name", "Question No", "Question Title", "Log Date", "Log Message", "API URL", "Document Name"];
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

  // Assessment overview columns
  const overviewColumns: ColumnDef<Assessment>[] = [
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
          "-"
        );
      },
    },
    {
      id: "actions",
      header: t("Action"),
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => handleViewAssessment(row.original)}>
          <Eye className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("View")}
        </Button>
      ),
    },
  ];

  // Filtered log assessments for left panel
  const filteredLogAssessments = logAssessments.filter((a) => {
    if (!logSearch) return true;
    const s = logSearch.toLowerCase();
    return (
      a.assessmentCode.toLowerCase().includes(s) ||
      a.vendor.name.toLowerCase().includes(s)
    );
  });

  const visibleLogAssessments = filteredLogAssessments.slice(0, logListOffset + LOG_LIST_LIMIT);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={t("Assessment Workspace")} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("Assessment Overview")}</TabsTrigger>
          <TabsTrigger value="logs">{t("Assessment Logs")}</TabsTrigger>
        </TabsList>

        {/* Assessment Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <DataGrid
            columns={overviewColumns}
            data={assessments}
            searchPlaceholder={t("Search assessments...")}
            searchColumn="assessmentCode"
          />
        </TabsContent>

        {/* Assessment Logs Tab */}
        <TabsContent value="logs" className="mt-4">
          <div className="flex gap-4 h-[600px]">
            {/* Left panel - Assessment list */}
            <div className="w-1/3 border rounded-lg flex flex-col">
              <div className="p-3 border-b">
                <Input
                  placeholder={t("Search assessments...")}
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogListOffset(0);
                  }}
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {visibleLogAssessments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelectLogAssessment(a)}
                    className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                      selectedLogAssessment?.assessment.id === a.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="font-mono text-sm font-medium">{a.assessmentCode}</div>
                    <div className="text-sm text-muted-foreground">{a.vendor.name}</div>
                    <Badge variant={getStatusVariant(a.status)} className="mt-1">
                      {t(a.status)}
                    </Badge>
                  </button>
                ))}
                {visibleLogAssessments.length < filteredLogAssessments.length && (
                  <button
                    onClick={() => setLogListOffset((prev) => prev + LOG_LIST_LIMIT)}
                    className="w-full p-3 text-sm text-primary hover:bg-muted/50"
                  >
                    {t("Load more")}...
                  </button>
                )}
              </div>
            </div>

            {/* Right panel - Log detail */}
            <div className="flex-1 border rounded-lg flex flex-col">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-semibold">
                  {selectedLogAssessment
                    ? `${selectedLogAssessment.assessment.assessmentCode} - ${selectedLogAssessment.assessment.vendorName}`
                    : t("Select an assessment")}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportLogs}
                    disabled={!selectedLogAssessment?.data?.length}
                  >
                    <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Export Excel")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedLogAssessment) {
                        const a = assessments.find((x) => x.id === selectedLogAssessment.assessment.id);
                        if (a) handleSelectLogAssessment(a);
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
                    {t("Refresh")}
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {logsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : selectedLogAssessment?.data?.length ? (
                  <div className="space-y-3">
                    {selectedLogAssessment.data.map((log) => (
                      <div key={log.id} className="border rounded-lg p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">{t("Domain Name")}:</span>{" "}
                            <span className="font-medium">{log.domainName || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("Question No")}:</span>{" "}
                            <span className="font-medium">{log.questionNo || "-"}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t("Question Title")}:</span>{" "}
                            <span className="font-medium">{log.questionTitle || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("Log Date")}:</span>{" "}
                            <span className="font-medium">{formatDate(log.logDate)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{t("Document Name")}:</span>{" "}
                            <span className="font-medium">{log.documentName || "-"}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{t("Log Message")}:</span>{" "}
                            <span className="font-medium">{log.logMessage || "-"}</span>
                          </div>
                          {log.apiUrl && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">{t("API URL")}:</span>{" "}
                              <span className="font-mono text-xs">{log.apiUrl}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    {selectedLogAssessment ? t("No logs found") : t("Select an assessment to view logs")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Assessment Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("Assessment Detail")} - {selectedAssessment?.assessmentCode}
            </DialogTitle>
          </DialogHeader>
          {selectedAssessment && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessment ID")}</label>
                <p className="font-mono">{selectedAssessment.assessmentCode}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessment Type")}</label>
                <p>{t(selectedAssessment.assessmentType)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor")}</label>
                <p>{selectedAssessment.vendor.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Status")}</label>
                <div>
                  <Badge variant={getStatusVariant(selectedAssessment.status)}>
                    {t(selectedAssessment.status)}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessment Result")}</label>
                <div>
                  {selectedAssessment.assessmentResult ? (
                    <Badge variant={getResultVariant(selectedAssessment.assessmentResult)}>
                      {t(selectedAssessment.assessmentResult)}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Questionnaire Template")}</label>
                <p>{selectedAssessment.questionnaireTemplate || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Vendor Submission Date")}</label>
                <p>{formatDate(selectedAssessment.vendorSubmissionDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessor Completion Date")}</label>
                <p>{formatDate(selectedAssessment.assessorCompletionDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Approval Date")}</label>
                <p>{formatDate(selectedAssessment.approvalDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Completion Date")}</label>
                <p>{formatDate(selectedAssessment.completionDate)}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Initiated By")}</label>
                <p>{selectedAssessment.initiatedBy?.fullName || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Assessor")}</label>
                <p>{selectedAssessment.assessor?.fullName || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("Approver")}</label>
                <p>{selectedAssessment.approver?.fullName || "-"}</p>
              </div>
              {selectedAssessment.approverComment && (
                <div className="col-span-2">
                  <label className="text-sm text-muted-foreground">{t("Approver Comment")}</label>
                  <p>{selectedAssessment.approverComment}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
