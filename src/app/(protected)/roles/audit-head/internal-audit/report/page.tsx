"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Eye,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  User,
  Building,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface AuditReport {
  id: string;
  reportCode: string;
  title: string;
  executiveSummary: string | null;
  scope: string | null;
  objectives: string | null;
  methodology: string | null;
  observations: string | null;
  recommendations: string | null;
  managementResponse: string | null;
  conclusion: string | null;
  status: string;
  publishedAt: string | null;
  reportFilePath: string | null;
  reportFileName: string | null;
  engagement: {
    id: string;
    auditId: string;
    engagementTitle: string;
    department: { id: string; name: string } | null;
    assignedAuditor: { id: string; firstName: string; lastName: string } | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    actualStartDate: string | null;
    actualEndDate: string | null;
    findings?: Array<{
      id: string;
      findingId: string;
      finding: string;
      severity: string;
      status: string;
    }>;
  };
}

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-800",
  Review: "bg-yellow-100 text-yellow-800",
  Final: "bg-blue-100 text-blue-800",
  Published: "bg-green-100 text-green-800",
};

const severityColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-red-100 text-red-800",
};

export default function AuditReportsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<AuditReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState<AuditReport | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const itemsPerPage = 10;

  const isAuditee =
    session?.user?.roles?.includes("Auditee") &&
    !session?.user?.roles?.includes("AuditHead") &&
    !session?.user?.roles?.includes("Auditor");

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/internal-audit/reports?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error("Failed to fetch reports");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((item) => {
    const matchesSearch =
      searchFilter === "" ||
      item.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.reportCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.engagement.auditId.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleView = async (report: AuditReport) => {
    try {
      const response = await fetch(`/api/internal-audit/reports/${report.id}`);
      if (response.ok) {
        const fullReport = await response.json();
        setSelectedReport(fullReport);
        setViewDialogOpen(true);
      } else {
        toast.error("Failed to fetch report details");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      toast.error("Failed to fetch report details");
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Draft":
        return <Clock className="h-4 w-4" />;
      case "Review":
        return <AlertTriangle className="h-4 w-4" />;
      case "Final":
      case "Published":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Calculate stats
  const stats = {
    draft: data.filter((r) => r.status === "Draft").length,
    review: data.filter((r) => r.status === "Review").length,
    final: data.filter((r) => r.status === "Final").length,
    published: data.filter((r) => r.status === "Published").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Audit Reports</h1>
          <p className="text-gray-500 mt-1">
            {isAuditee
              ? "Reports assigned to you by the Audit Head"
              : "View and manage audit reports"}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isAuditee ? "Total Reports" : "Draft"}
            </CardTitle>
            <Clock className="h-5 w-5 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isAuditee ? data.length : stats.draft}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {isAuditee ? "Published" : "In Review"}
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isAuditee ? stats.published : stats.review}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Final</CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.final}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Published</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by report code, title, or audit ID"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        {!isAuditee && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Review">Review</SelectItem>
              <SelectItem value="Final">Final</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : paginatedData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No audit reports found</p>
            {isAuditee && (
              <p className="text-sm mt-2">
                Reports assigned to you by the Audit Head will appear here
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Audit ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Published Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row) => (
                <TableRow key={row.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{row.reportCode}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.title}</TableCell>
                  <TableCell>{row.engagement.auditId}</TableCell>
                  <TableCell>{row.engagement.department?.name || "-"}</TableCell>
                  <TableCell>{formatDate(row.publishedAt)}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[row.status] || ""}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(row.status)}
                        {row.status}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleView(row)}>
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                      {row.reportFilePath && (
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && filteredData.length > 0 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of{" "}
              {filteredData.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>

      {/* View Report Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedReport?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.reportCode} | {selectedReport?.engagement.auditId}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              {/* Report Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="font-medium text-sm">
                      {selectedReport.engagement.department?.name || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Lead Auditor</p>
                    <p className="font-medium text-sm">
                      {selectedReport.engagement.assignedAuditor
                        ? `${selectedReport.engagement.assignedAuditor.firstName} ${selectedReport.engagement.assignedAuditor.lastName}`
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Audit Period</p>
                    <p className="font-medium text-sm">
                      {formatDate(selectedReport.engagement.actualStartDate)} -{" "}
                      {formatDate(selectedReport.engagement.actualEndDate)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge className={statusColors[selectedReport.status] || ""}>
                    {selectedReport.status}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Executive Summary */}
              {selectedReport.executiveSummary && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Executive Summary</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedReport.executiveSummary}
                  </p>
                </div>
              )}

              {/* Scope & Objectives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedReport.scope && (
                  <div>
                    <h3 className="font-semibold mb-2">Scope</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedReport.scope}
                    </p>
                  </div>
                )}
                {selectedReport.objectives && (
                  <div>
                    <h3 className="font-semibold mb-2">Objectives</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedReport.objectives}
                    </p>
                  </div>
                )}
              </div>

              {/* Observations */}
              {selectedReport.observations && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Observations</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedReport.observations}
                  </p>
                </div>
              )}

              {/* Findings Summary */}
              {selectedReport.engagement.findings &&
                selectedReport.engagement.findings.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">
                      Findings ({selectedReport.engagement.findings.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedReport.engagement.findings.map((finding) => (
                        <div
                          key={finding.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Badge className={severityColors[finding.severity] || ""}>
                              {finding.severity}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{finding.findingId}</p>
                              <p className="text-sm text-gray-600">{finding.finding}</p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              finding.status === "Closed"
                                ? "bg-green-50 text-green-700"
                                : "bg-yellow-50 text-yellow-700"
                            }
                          >
                            {finding.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Recommendations */}
              {selectedReport.recommendations && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Recommendations</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedReport.recommendations}
                  </p>
                </div>
              )}

              {/* Management Response */}
              {selectedReport.managementResponse && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Management Response</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedReport.managementResponse}
                  </p>
                </div>
              )}

              {/* Conclusion */}
              {selectedReport.conclusion && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">Conclusion</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedReport.conclusion}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedReport?.reportFilePath && (
              <Button variant="outline">
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
