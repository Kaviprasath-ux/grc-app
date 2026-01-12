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
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Eye,
  Upload,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Paperclip,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Attachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  uploadedAt: string;
}

interface EvidenceRequest {
  id: string;
  title: string;
  description: string | null;
  sampleSize: string | null;
  status: string;
  aiReviewStatus: string | null;
  aiReviewComment: string | null;
  dueDate: string | null;
  auditeeId: string | null;
  auditeeName: string | null;
  createdAt: string;
  engagement: {
    id: string;
    auditId: string;
    engagementTitle: string;
    department: {
      id: string;
      name: string;
    } | null;
    assignedAuditor: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  };
  attachments: Attachment[];
}

const statusColors: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Submitted: "bg-purple-100 text-purple-800",
  Reviewed: "bg-green-100 text-green-800",
};

const aiStatusColors: Record<string, string> = {
  Satisfactory: "bg-green-100 text-green-800",
  "Needs Attention": "bg-red-100 text-red-800",
};

export default function FieldworkPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<EvidenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<EvidenceRequest | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const itemsPerPage = 10;

  const isAuditee = session?.user?.roles?.includes("Auditee") &&
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

      const response = await fetch(`/api/internal-audit/fieldwork?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error("Failed to fetch evidence requests");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch evidence requests");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((item) => {
    const matchesSearch =
      searchFilter === "" ||
      item.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.engagement.auditId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.engagement.engagementTitle.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleView = (request: EvidenceRequest) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const handleUpload = (request: EvidenceRequest) => {
    setSelectedRequest(request);
    setUploadDialogOpen(true);
  };

  const handleSubmitEvidence = async () => {
    if (!selectedRequest) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/internal-audit/fieldwork/${selectedRequest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Submitted" }),
      });

      if (response.ok) {
        toast.success("Evidence submitted successfully");
        setUploadDialogOpen(false);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to submit evidence");
      }
    } catch (error) {
      console.error("Error submitting evidence:", error);
      toast.error("Failed to submit evidence");
    } finally {
      setSubmitting(false);
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
      case "Pending":
        return <Clock className="h-4 w-4" />;
      case "In Progress":
        return <AlertCircle className="h-4 w-4" />;
      case "Submitted":
        return <Upload className="h-4 w-4" />;
      case "Reviewed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Calculate stats
  const stats = {
    pending: data.filter((d) => d.status === "Pending").length,
    inProgress: data.filter((d) => d.status === "In Progress").length,
    submitted: data.filter((d) => d.status === "Submitted").length,
    reviewed: data.filter((d) => d.status === "Reviewed").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fieldwork - Evidence Requests</h1>
          <p className="text-gray-500 mt-1">
            {isAuditee
              ? "Evidence requests assigned to you"
              : "Manage evidence requests for audits"}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending</CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">In Progress</CardTitle>
            <AlertCircle className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Submitted</CardTitle>
            <Upload className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Reviewed</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reviewed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by title, audit ID, or engagement"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Submitted">Submitted</SelectItem>
            <SelectItem value="Reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : paginatedData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isAuditee
              ? "No evidence requests assigned to you yet."
              : "No evidence requests found."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Audit ID</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Evidence Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Review</TableHead>
                <TableHead>Attachments</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row) => (
                <TableRow key={row.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{row.engagement.auditId}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {row.engagement.engagementTitle}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.title}</TableCell>
                  <TableCell>{row.engagement.department?.name || "-"}</TableCell>
                  <TableCell>{formatDate(row.dueDate)}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[row.status] || "bg-gray-100 text-gray-800"}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(row.status)}
                        {row.status}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.aiReviewStatus ? (
                      <Badge className={aiStatusColors[row.aiReviewStatus] || ""}>
                        {row.aiReviewStatus}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-4 w-4 text-gray-400" />
                      {row.attachments.length}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleView(row)}>
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                      {isAuditee && (row.status === "Pending" || row.status === "In Progress") && (
                        <Button variant="ghost" size="icon" onClick={() => handleUpload(row)}>
                          <Upload className="h-4 w-4 text-green-600" />
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
              {startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length}
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

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evidence Request Details</DialogTitle>
            <DialogDescription>
              {selectedRequest?.engagement.auditId} - {selectedRequest?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Engagement</Label>
                  <p className="font-medium">{selectedRequest.engagement.engagementTitle}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Department</Label>
                  <p className="font-medium">{selectedRequest.engagement.department?.name || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Assigned Auditor</Label>
                  <p className="font-medium">
                    {selectedRequest.engagement.assignedAuditor
                      ? `${selectedRequest.engagement.assignedAuditor.firstName} ${selectedRequest.engagement.assignedAuditor.lastName}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Due Date</Label>
                  <p className="font-medium">{formatDate(selectedRequest.dueDate)}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Sample Size</Label>
                  <p className="font-medium">{selectedRequest.sampleSize || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Status</Label>
                  <Badge className={statusColors[selectedRequest.status] || ""}>
                    {selectedRequest.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Description</Label>
                <p className="text-sm mt-1">{selectedRequest.description || "No description provided"}</p>
              </div>

              {selectedRequest.aiReviewStatus && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Label className="text-sm text-gray-500">AI Review</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={aiStatusColors[selectedRequest.aiReviewStatus] || ""}>
                      {selectedRequest.aiReviewStatus}
                    </Badge>
                    {selectedRequest.aiReviewComment && (
                      <span className="text-sm text-gray-600">{selectedRequest.aiReviewComment}</span>
                    )}
                  </div>
                </div>
              )}

              {selectedRequest.attachments.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-500">Attachments</Label>
                  <div className="mt-2 space-y-2">
                    {selectedRequest.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                      >
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{attachment.fileName}</span>
                        <span className="text-xs text-gray-400">
                          ({Math.round((attachment.fileSize || 0) / 1024)} KB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload/Submit Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Evidence</DialogTitle>
            <DialogDescription>
              Upload files and submit evidence for: {selectedRequest?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{selectedRequest.description}</p>
                {selectedRequest.sampleSize && (
                  <p className="text-sm text-gray-500 mt-2">
                    <strong>Sample Size:</strong> {selectedRequest.sampleSize}
                  </p>
                )}
              </div>

              <div>
                <Label>Upload Evidence Files</Label>
                <div className="mt-2 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Drag and drop files here, or click to browse
                  </p>
                  <Input
                    type="file"
                    multiple
                    className="mt-2"
                    onChange={(e) => {
                      // Handle file upload
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        toast.info(`${files.length} file(s) selected`);
                      }
                    }}
                  />
                </div>
              </div>

              {selectedRequest.attachments.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-500">Previously Uploaded</Label>
                  <div className="mt-2 space-y-2">
                    {selectedRequest.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                      >
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{attachment.fileName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEvidence}
              disabled={submitting}
              className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
            >
              {submitting ? "Submitting..." : "Submit Evidence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
