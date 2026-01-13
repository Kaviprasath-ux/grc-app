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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PlayCircle,
  FileText,
  Upload,
} from "lucide-react";

interface CAPA {
  id: string;
  capaId: string;
  title: string;
  description: string | null;
  actionType: string;
  responsiblePerson: string | null;
  targetDate: string | null;
  completedDate: string | null;
  status: string;
  evidenceFilePath: string | null;
  evidenceFileName: string | null;
  finding: {
    id: string;
    findingId: string;
    finding: string;
    severity: string;
    department: { id: string; name: string } | null;
    engagement: {
      id: string;
      auditId: string;
      engagementTitle: string;
    };
  };
}

const statusColors: Record<string, string> = {
  Open: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Closed: "bg-green-100 text-green-800",
  Overdue: "bg-red-100 text-red-800",
};

const severityColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-red-100 text-red-800",
};

export default function CAPATrackingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<CAPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCAPA, setSelectedCAPA] = useState<CAPA | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updateNotes, setUpdateNotes] = useState("");
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

      const response = await fetch(`/api/internal-audit/capa?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error("Failed to fetch CAPAs");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch CAPAs");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((item) => {
    const matchesSearch =
      searchFilter === "" ||
      item.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.capaId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.finding.findingId.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleView = (capa: CAPA) => {
    setSelectedCAPA(capa);
    setViewDialogOpen(true);
  };

  const handleUpdate = (capa: CAPA) => {
    setSelectedCAPA(capa);
    setUpdateNotes("");
    setUpdateDialogOpen(true);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedCAPA) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/internal-audit/capa/${selectedCAPA.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`CAPA marked as ${newStatus}`);
        setUpdateDialogOpen(false);
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update CAPA");
      }
    } catch (error) {
      console.error("Error updating CAPA:", error);
      toast.error("Failed to update CAPA");
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

  const isOverdue = (capa: CAPA) => {
    if (!capa.targetDate || capa.status === "Closed") return false;
    return new Date(capa.targetDate) < new Date();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Open":
        return <Clock className="h-4 w-4" />;
      case "In Progress":
        return <PlayCircle className="h-4 w-4" />;
      case "Closed":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Calculate stats
  const stats = {
    open: data.filter((c) => c.status === "Open").length,
    inProgress: data.filter((c) => c.status === "In Progress").length,
    closed: data.filter((c) => c.status === "Closed").length,
    overdue: data.filter((c) => isOverdue(c)).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CAPA Tracking</h1>
          <p className="text-gray-500 mt-1">
            {isAuditee
              ? "Corrective actions assigned to you"
              : "Track corrective and preventive actions"}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Open</CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">In Progress</CardTitle>
            <PlayCircle className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Closed</CardTitle>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow border-red-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Overdue</CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by CAPA ID, title, or finding"
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
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : paginatedData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No corrective actions found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CAPA ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Finding</TableHead>
                <TableHead>Audit</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row) => (
                <TableRow
                  key={row.id}
                  className={`hover:bg-gray-50 ${isOverdue(row) ? "bg-red-50" : ""}`}
                >
                  <TableCell className="font-medium">{row.capaId}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.title}</TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {row.finding.findingId}
                  </TableCell>
                  <TableCell>{row.finding.engagement.auditId}</TableCell>
                  <TableCell>
                    <Badge className={severityColors[row.finding.severity] || ""}>
                      {row.finding.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={isOverdue(row) ? "text-red-600 font-medium" : ""}>
                      {formatDate(row.targetDate)}
                    </span>
                  </TableCell>
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
                      {isAuditee && row.status !== "Closed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUpdate(row)}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
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

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>CAPA Details</DialogTitle>
            <DialogDescription>
              {selectedCAPA?.capaId} - {selectedCAPA?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedCAPA && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Action Type</Label>
                  <p className="font-medium">{selectedCAPA.actionType}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Responsible Person</Label>
                  <p className="font-medium">{selectedCAPA.responsiblePerson || "-"}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Target Date</Label>
                  <p className="font-medium">{formatDate(selectedCAPA.targetDate)}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Status</Label>
                  <Badge className={statusColors[selectedCAPA.status] || ""}>
                    {selectedCAPA.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Description</Label>
                <p className="text-sm mt-1">
                  {selectedCAPA.description || "No description provided"}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <Label className="text-sm text-gray-500">Related Finding</Label>
                <div className="mt-2">
                  <p className="font-medium">
                    {selectedCAPA.finding.findingId} - {selectedCAPA.finding.finding}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Audit: {selectedCAPA.finding.engagement.auditId} -{" "}
                    {selectedCAPA.finding.engagement.engagementTitle}
                  </p>
                  <Badge className={severityColors[selectedCAPA.finding.severity] || ""}>
                    {selectedCAPA.finding.severity} Severity
                  </Badge>
                </div>
              </div>

              {selectedCAPA.evidenceFileName && (
                <div>
                  <Label className="text-sm text-gray-500">Evidence Submitted</Label>
                  <div className="flex items-center gap-2 mt-1 p-2 bg-green-50 rounded">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{selectedCAPA.evidenceFileName}</span>
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

      {/* Update Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update CAPA Status</DialogTitle>
            <DialogDescription>
              {selectedCAPA?.capaId} - {selectedCAPA?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedCAPA && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm">{selectedCAPA.description}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Target Date: {formatDate(selectedCAPA.targetDate)}
                </p>
              </div>

              <div>
                <Label>Upload Evidence (Optional)</Label>
                <div className="mt-2 border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                  <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <Input
                    type="file"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        toast.info(`${files[0].name} selected`);
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes about the corrective action..."
                  value={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Cancel
            </Button>
            {selectedCAPA?.status === "Open" && (
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate("In Progress")}
                disabled={submitting}
              >
                <PlayCircle className="h-4 w-4 mr-1" />
                Mark In Progress
              </Button>
            )}
            <Button
              onClick={() => handleStatusUpdate("Closed")}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {submitting ? "Closing..." : "Mark as Closed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
