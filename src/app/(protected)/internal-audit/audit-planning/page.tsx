"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  department: Department | null;
  auditType: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assignedAuditors: string[];
}

export default function AuditPlanningPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Engagement | null>(null);

  // Report generation dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFilterType, setReportFilterType] = useState("");
  const [reportYear, setReportYear] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  const isAuditHead = session?.user?.roles?.includes("AuditHead");

  useEffect(() => {
    fetchDepartments();
    fetchEngagements();
    fetchAvailableYears();
  }, []);

  useEffect(() => {
    fetchEngagements();
  }, [departmentFilter, statusFilter, yearFilter, searchFilter]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchAvailableYears = async () => {
    try {
      const response = await fetch("/api/internal-audit/engagements/years");
      if (response.ok) {
        const data = await response.json();
        setAvailableYears(data);
      }
    } catch (error) {
      console.error("Failed to fetch available years:", error);
    }
  };

  const fetchEngagements = async () => {
    try {
      const params = new URLSearchParams();
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (yearFilter && yearFilter !== "all") params.append("year", yearFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await fetch(`/api/internal-audit/engagements?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEngagements(data);
      }
    } catch (error) {
      console.error("Failed to fetch engagements:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (item: Engagement) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/engagements/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Engagement deleted successfully");
        fetchEngagements();
      } else {
        toast.error("Failed to delete engagement");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error("Failed to delete engagement");
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      // Create CSV content
      const headers = ["Audit ID", "Engagement Title", "Department", "Audit Type", "Assigned Auditors", "Status"];
      const rows = engagements.map(e => [
        e.auditId,
        e.engagementTitle,
        e.department?.name || "",
        e.auditType || "",
        e.assignedAuditors.join("; "),
        e.status
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-plan-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Export completed");
    } catch (error) {
      toast.error("Failed to export");
    }
  };

  const openReportDialog = () => {
    setReportFilterType("");
    setReportYear("");
    setReportStartDate("");
    setReportEndDate("");
    setReportDialogOpen(true);
  };

  const handleShowReport = () => {
    if (!reportFilterType) {
      toast.error("Please select a filter type");
      return;
    }
    if (reportFilterType === "Year" && !reportYear) {
      toast.error("Please select a year");
      return;
    }
    if (reportFilterType === "DateRange") {
      if (!reportStartDate) {
        toast.error("Please select a start date");
        return;
      }
      if (!reportEndDate) {
        toast.error("Please select an end date");
        return;
      }
      if (new Date(reportStartDate) > new Date(reportEndDate)) {
        toast.error("Start date cannot be after end date");
        return;
      }
    }

    setReportDialogOpen(false);

    if (reportFilterType === "Year") {
      router.push(`/internal-audit/audit-planning/report-preview?filterType=Year&year=${reportYear}`);
    } else {
      router.push(`/internal-audit/audit-planning/report-preview?filterType=DateRange&startDate=${reportStartDate}&endDate=${reportEndDate}`);
    }
  };


  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-blue-900 mb-6">Annual Audit Plan</h1>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-blue-900">Annual Audit Plan</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={openReportDialog}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Annual Plan Report
          </Button>
          {isAuditHead && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push("/internal-audit/audit-planning/add")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Engagement
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search By Audit ID, Name"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Planned">Planned</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-900 hover:bg-blue-900">
              <TableHead className="text-white">Audit ID</TableHead>
              <TableHead className="text-white">Engagement Name</TableHead>
              <TableHead className="text-white">Department</TableHead>
              <TableHead className="text-white">Audit Type</TableHead>
              <TableHead className="text-white">Assigned Auditors</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engagements.length > 0 ? (
              engagements.map((engagement) => (
                <TableRow key={engagement.id}>
                  <TableCell className="font-medium">{engagement.auditId}</TableCell>
                  <TableCell>{engagement.engagementTitle}</TableCell>
                  <TableCell>{engagement.department?.name || "-"}</TableCell>
                  <TableCell>{engagement.auditType || "-"}</TableCell>
                  <TableCell>
                    {engagement.assignedAuditors.length > 0
                      ? engagement.assignedAuditors.join(", ")
                      : "No items found"}
                  </TableCell>
                  <TableCell>{engagement.status}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/internal-audit/audit-planning/${engagement.id}/edit`)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(engagement)}
                        title="Delete"
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No audit engagements found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this engagement?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>OK</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Selection Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Year</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filterType">Filter Type</Label>
              <Select value={reportFilterType} onValueChange={setReportFilterType}>
                <SelectTrigger id="filterType">
                  <SelectValue placeholder="Select filter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year">Year</SelectItem>
                  <SelectItem value="DateRange">DateRange</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportFilterType === "Year" && (
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Select value={reportYear} onValueChange={setReportYear}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportFilterType === "DateRange" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    placeholder="dd/mm/yyyy"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={handleShowReport} className="bg-blue-600 hover:bg-blue-700">
              Show Report
            </Button>
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
