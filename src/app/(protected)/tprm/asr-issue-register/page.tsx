"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DataGrid } from "@/components/shared/data-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Home, ChevronRight, Download, Search, X, AlertTriangle, ArrowLeft } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "@/hooks/use-toast";
import { RemediationComments } from "@/components/tprm/remediation-comments";

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

interface VendorRiskIssue {
  id: string;
  remediationId: string | null;
  domain: string | null;
  severity: string;
  issue: string | null;
  risk: string | null;
  recommendation: string | null;
  assessmentCode: string | null;
  dueDate: string | null;
  status: string;
  issueCode: string;
  questionNo: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  Open: "border-blue-300 bg-blue-50 text-blue-700",
  "In Progress": "border-yellow-300 bg-yellow-50 text-yellow-700",
  Closed: "border-slate-300 bg-slate-50 text-slate-700",
  Resolved: "border-green-300 bg-green-50 text-green-700",
  Pending: "border-yellow-300 bg-yellow-50 text-yellow-700",
  "Assigned to BO": "border-blue-300 bg-blue-50 text-blue-700",
  "Assigned to IT": "border-indigo-300 bg-indigo-50 text-indigo-700",
  "IT Submitted": "border-teal-300 bg-teal-50 text-teal-700",
  "IT Approved": "border-emerald-300 bg-emerald-50 text-emerald-700",
  "Returned to IT": "border-rose-300 bg-rose-50 text-rose-700",
  Submitted: "border-orange-300 bg-orange-50 text-orange-700",
  Overdue: "border-red-300 bg-red-50 text-red-700",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString();
}

function getSeverityVariant(severity: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "High": return "destructive";
    case "Medium": return "secondary";
    case "Low": return "default";
    default: return "outline";
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Open": return "secondary";
    case "Overdue": return "destructive";
    case "Closed": return "default";
    default: return "outline";
  }
}

export default function AsrIssueRegisterPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [entries, setEntries] = useState<IssueRegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorSearch, setVendorSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Vendor risk register drill-down
  const [selectedVendor, setSelectedVendor] = useState<{ id: string; name: string } | null>(null);
  const [vendorRiskIssues, setVendorRiskIssues] = useState<VendorRiskIssue[]>([]);
  const [vendorRiskLoading, setVendorRiskLoading] = useState(false);
  const [riskDomainSearch, setRiskDomainSearch] = useState("");
  const [viewIssueDetail, setViewIssueDetail] = useState<VendorRiskIssue | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tprm/asr-issues?tab=register&limit=200");
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

  const loadVendorRiskIssues = useCallback(async (vendorId: string, vendorName: string) => {
    setSelectedVendor({ id: vendorId, name: vendorName });
    setVendorRiskLoading(true);
    setRiskDomainSearch("");
    try {
      const res = await fetch(`/api/tprm/asr-issues?tab=register-detail&vendorId=${vendorId}`);
      if (res.ok) {
        const json = await res.json();
        setVendorRiskIssues(json.data || []);
      }
    } catch {
      toast({ title: t("Error"), description: t("Failed to load vendor issues"), variant: "destructive" });
    } finally {
      setVendorRiskLoading(false);
    }
  }, [toast, t]);

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
      e.department || "", e.businessOwner || "", e.vendor, e.vendorId, e.high, e.medium, e.low, e.total, e.status,
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
        <button
          className="text-primary hover:underline font-medium"
          onClick={() => loadVendorRiskIssues(row.original.id, row.original.vendor)}
        >
          {row.getValue("vendor")}
        </button>
      ),
    },
    { accessorKey: "vendorId", header: t("Vendor ID") },
    {
      accessorKey: "high",
      header: t("High"),
      cell: ({ row }) => <span className={`font-semibold ${(row.getValue("high") as number) > 0 ? "text-red-600" : "text-muted-foreground"}`}>{row.getValue("high")}</span>,
    },
    {
      accessorKey: "medium",
      header: t("Medium"),
      cell: ({ row }) => <span className={`font-semibold ${(row.getValue("medium") as number) > 0 ? "text-orange-500" : "text-muted-foreground"}`}>{row.getValue("medium")}</span>,
    },
    {
      accessorKey: "low",
      header: t("Low"),
      cell: ({ row }) => <span className={`font-semibold ${(row.getValue("low") as number) > 0 ? "text-green-600" : "text-muted-foreground"}`}>{row.getValue("low")}</span>,
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
        <Badge variant={getStatusVariant(row.getValue("status"))}>{t(row.getValue("status") as string)}</Badge>
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

      {selectedVendor ? (
        /* ---- Vendor Risk Register Drill-down ---- */
        <>
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => { setSelectedVendor(null); setVendorRiskIssues([]); }}>
              <ArrowLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
              {t("Back")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const headers = ["Domain", "Severity", "Issue", "Risk", "Assessment ID", "Due Date", "Status"];
              const rows = vendorRiskIssues.map((i) => [
                i.domain || "", i.severity, (i.issue || "").replace(/,/g, ";"), (i.risk || "").replace(/,/g, ";"),
                i.assessmentCode || "", i.dueDate ? new Date(i.dueDate).toLocaleDateString() : "", i.status,
              ]);
              const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `risk-register-${selectedVendor.name}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download className="h-4 w-4 ltr:mr-1 rtl:ml-1" /> {t("Export")}
            </Button>
          </div>

          <h2 className="text-xl font-bold">{t("Risk Register For")} {selectedVendor.name}</h2>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("Search Domain")}
              value={riskDomainSearch}
              onChange={(e) => setRiskDomainSearch(e.target.value)}
              className="pl-9"
            />
            {riskDomainSearch && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setRiskDomainSearch("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {vendorRiskLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (() => {
            const filteredRisk = vendorRiskIssues.filter((i) =>
              !riskDomainSearch || (i.domain && i.domain.toLowerCase().includes(riskDomainSearch.toLowerCase()))
            );
            return filteredRisk.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>{t("No issues found")}</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_100px_1.5fr_1.5fr_120px_100px_100px] bg-muted/50 border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  <span>{t("Domain")}</span>
                  <span>{t("Severity")}</span>
                  <span>{t("Issue")}</span>
                  <span>{t("Risk")}</span>
                  <span>{t("Assessment ID")}</span>
                  <span>{t("Due Date")}</span>
                  <span>{t("Status")}</span>
                </div>
                <div className="divide-y">
                  {filteredRisk.map((issue) => (
                    <div key={issue.id} className="grid grid-cols-[1fr_100px_1.5fr_1.5fr_120px_100px_100px] px-4 py-3 text-sm items-start gap-y-1">
                      <span className="text-primary font-medium">{issue.domain || "-"}</span>
                      <span>
                        <Badge variant={getSeverityVariant(issue.severity)} className="text-xs">{t(issue.severity)}</Badge>
                      </span>
                      <span className="text-muted-foreground line-clamp-2">{issue.issue || "-"}</span>
                      <span className="text-muted-foreground line-clamp-2">{issue.risk || "-"}</span>
                      <span className="font-mono text-xs">{issue.assessmentCode || "-"}</span>
                      <span>{formatDate(issue.dueDate)}</span>
                      <span>
                        <button onClick={() => setViewIssueDetail(issue)}>
                          <Badge variant="outline" className={`${STATUS_COLORS[issue.status] || ""} text-xs font-medium cursor-pointer hover:opacity-80`}>
                            {t(issue.status)}
                          </Badge>
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      ) : (
        /* ---- Main Issue Register Table ---- */
        <>
          <h2 className="text-xl font-bold">{t("Issue Register")}</h2>

          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("Vendor Name")}
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="pl-9"
              />
              {vendorSearch && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setVendorSearch("")}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
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
        </>
      )}

      {/* ==================== ISSUE REGISTER DETAILS DIALOG ==================== */}
      <Dialog open={!!viewIssueDetail} onOpenChange={(open) => { if (!open) setViewIssueDetail(null); }}>
        <DialogContent className="!max-w-3xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Issue Register Details")}</DialogTitle>
          </DialogHeader>
          {viewIssueDetail && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h5 className="font-semibold text-sm">{t("Issue")} : {viewIssueDetail.issueCode}</h5>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-semibold">{t("Due Date")}: {formatDate(viewIssueDetail.dueDate)}</span>
                  <Badge variant="outline" className={`${STATUS_COLORS[viewIssueDetail.status] || ""} text-xs font-medium`}>
                    {t(viewIssueDetail.status)}
                  </Badge>
                </div>
              </div>
              <div>
                <Textarea value={viewIssueDetail.issue || ""} readOnly rows={5} className="bg-muted/50 text-sm" />
              </div>
              <div>
                <h5 className="font-semibold text-sm mb-2">{t("Risk")}</h5>
                <Textarea value={viewIssueDetail.risk || ""} readOnly rows={4} className="bg-muted/50 text-sm" />
              </div>
              <div>
                <h5 className="font-semibold text-sm mb-2">{t("Recommendation")}</h5>
                <Textarea value={viewIssueDetail.recommendation || ""} readOnly rows={4} className="bg-muted/50 text-sm" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="font-semibold text-sm mb-2">{t("Severity")}</h5>
                  <Badge variant={getSeverityVariant(viewIssueDetail.severity)} className="text-sm">
                    {t(viewIssueDetail.severity)}
                  </Badge>
                </div>
                {viewIssueDetail.remediationId && (
                  <RemediationComments remediationId={viewIssueDetail.remediationId} readOnly />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewIssueDetail(null)}>{t("Cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
