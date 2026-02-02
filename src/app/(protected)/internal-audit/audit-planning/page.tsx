"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Download,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";

interface Department {
  id: string;
  name: string;
}

interface Risk {
  id: string;
  riskId: string;
  riskName: string;
  riskLevel: string | null;
}

interface User {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
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

  // Add Engagement dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogLoading, setAddDialogLoading] = useState(false);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [auditors, setAuditors] = useState<User[]>([]);
  const [auditees, setAuditees] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);
  const [engagementForm, setEngagementForm] = useState({
    engagementTitle: "",
    engagementObjective: "",
    engagementScope: "",
    departmentId: "",
    linkedRiskIds: [] as string[],
    auditRating: "",
    auditType: "",
    auditorId: "",
    auditeeId: "",
    startDate: "",
    targetDate: "",
  });

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

  const fetchRisksForDepartment = async (departmentId: string) => {
    try {
      const response = await fetch(`/api/internal-audit/risks?departmentId=${departmentId}&status=Open`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    }
  };

  const fetchAuditorsAndAuditees = async () => {
    try {
      const [auditeesRes, auditorsRes] = await Promise.all([
        fetch("/api/users?forAuditHead=auditees"),
        fetch("/api/users?forAuditHead=auditors"),
      ]);

      if (auditeesRes.ok) {
        const auditeesData = await auditeesRes.json();
        setAuditees(auditeesData.users || auditeesData || []);
      }
      if (auditorsRes.ok) {
        const auditorsData = await auditorsRes.json();
        setAuditors(auditorsData.users || auditorsData || []);
      }
    } catch (error) {
      console.error("Failed to fetch auditors/auditees:", error);
    }
  };

  const openAddDialog = async () => {
    setEngagementForm({
      engagementTitle: "",
      engagementObjective: "",
      engagementScope: "",
      departmentId: "",
      linkedRiskIds: [],
      auditRating: "",
      auditType: "",
      auditorId: "",
      auditeeId: "",
      startDate: "",
      targetDate: "",
    });
    setRisks([]);
    setAddDialogOpen(true);
    setAddDialogLoading(true);
    await fetchAuditorsAndAuditees();
    setAddDialogLoading(false);
  };

  const handleEngagementDepartmentChange = async (departmentId: string) => {
    setEngagementForm({ ...engagementForm, departmentId, linkedRiskIds: [] });
    if (departmentId) {
      await fetchRisksForDepartment(departmentId);
    } else {
      setRisks([]);
    }
  };

  const handleSaveEngagement = async () => {
    if (!engagementForm.engagementTitle.trim()) {
      toast.error("Engagement Title is required");
      return;
    }
    if (!engagementForm.engagementObjective.trim()) {
      toast.error("Engagement Objective is required");
      return;
    }
    if (!engagementForm.engagementScope.trim()) {
      toast.error("Engagement Scope is required");
      return;
    }
    if (!engagementForm.departmentId) {
      toast.error("Department is required");
      return;
    }
    if (!engagementForm.auditorId) {
      toast.error("Auditor is required");
      return;
    }
    if (!engagementForm.startDate) {
      toast.error("Start Date is required");
      return;
    }
    if (!engagementForm.targetDate) {
      toast.error("Target Date is required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/internal-audit/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(engagementForm),
      });

      if (response.ok) {
        toast.success("Engagement created successfully");
        setAddDialogOpen(false);
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create engagement");
      }
    } catch (error) {
      console.error("Failed to create engagement:", error);
      toast.error("Failed to create engagement");
    } finally {
      setSaving(false);
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Annual Audit Plan</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Internal Audit</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Audit Planning</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Annual Audit Plan</h1>
      </div>

      {/* Search, Filters, and Actions Row */}
      <div className="flex items-center gap-3">
        <div className="relative w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search By Audit ID, Name"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10 h-9 bg-white border-slate-200"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-white">
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
          <SelectTrigger className="w-[140px] h-9 bg-white">
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
          <SelectTrigger className="w-[110px] h-9 bg-white">
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
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" size="sm" className="border-primary-600 text-primary-600 hover:bg-primary-50" onClick={openReportDialog}>
          <FileText className="h-4 w-4 mr-2" />
          Generate Annual Plan Report
        </Button>
        {isAuditHead && (
          <Button size="sm" className="bg-primary-600 hover:bg-primary-700" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Engagement
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 py-4 pl-4">Audit ID</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">Engagement Name</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">Department</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">Audit Type</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">Assigned Auditors</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4 pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engagements.length > 0 ? (
              engagements.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 pl-4 text-sm font-medium text-slate-800">{engagement.auditId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.engagementTitle}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.department?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.auditType || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">
                    {engagement.assignedAuditors.length > 0
                      ? engagement.assignedAuditors.join(", ")
                      : "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.status}</TableCell>
                  <TableCell className="py-3 pr-4">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => router.push(`/internal-audit/audit-planning/${engagement.id}/edit`)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(engagement)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No audit engagements found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
        <DialogContent className="sm:max-w-[500px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Generate Annual Plan Report
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Filter Type <span className="text-red-500">*</span>
              </Label>
              <Select value={reportFilterType} onValueChange={setReportFilterType}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select filter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year">Year</SelectItem>
                  <SelectItem value="DateRange">Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportFilterType === "Year" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Year <span className="text-red-500">*</span>
                </Label>
                <Select value={reportYear} onValueChange={setReportYear}>
                  <SelectTrigger className="w-full bg-white">
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
                  <Label className="text-sm font-medium text-slate-700">
                    Start Date <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={reportStartDate}
                    onChange={(date) => setReportStartDate(date ? date.toISOString().split('T')[0] : "")}
                    placeholder="Select start date"
                    className="w-full h-10 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    End Date <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={reportEndDate}
                    onChange={(date) => setReportEndDate(date ? date.toISOString().split('T')[0] : "")}
                    placeholder="Select end date"
                    className="w-full h-10 bg-white"
                  />
                </div>
              </>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleShowReport} className="bg-primary-600 hover:bg-primary-700">
              Show Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Engagement Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                Add Engagement
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {addDialogLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Engagement Title */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Engagement Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={engagementForm.engagementTitle}
                    onChange={(e) => setEngagementForm({ ...engagementForm, engagementTitle: e.target.value })}
                    placeholder="Enter engagement title"
                    className="w-full bg-white"
                  />
                </div>

                {/* Engagement Objective */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Engagement Objective <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={engagementForm.engagementObjective}
                    onChange={(e) => setEngagementForm({ ...engagementForm, engagementObjective: e.target.value })}
                    placeholder="Enter engagement objective"
                    rows={3}
                    className="w-full bg-white resize-none"
                  />
                </div>

                {/* Engagement Scope */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Engagement Scope <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    value={engagementForm.engagementScope}
                    onChange={(e) => setEngagementForm({ ...engagementForm, engagementScope: e.target.value })}
                    placeholder="Enter engagement scope"
                    rows={3}
                    className="w-full bg-white resize-none"
                  />
                </div>

                {/* Department */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Department <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={engagementForm.departmentId}
                    onValueChange={handleEngagementDepartmentChange}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Link Open Risks */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    Link Open Risks
                  </Label>
                  <Select
                    value={engagementForm.linkedRiskIds[0] || ""}
                    onValueChange={(value) => setEngagementForm({ ...engagementForm, linkedRiskIds: value ? [value] : [] })}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                    <SelectContent>
                      {risks.length > 0 ? (
                        risks.map((risk) => (
                          <SelectItem key={risk.id} value={risk.id}>
                            {risk.riskId} - {risk.riskName}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          {engagementForm.departmentId ? "No open risks found" : "Select a department first"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Two columns for Audit Rating and Audit Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Audit Rating</Label>
                    <Select
                      value={engagementForm.auditRating}
                      onValueChange={(value) => setEngagementForm({ ...engagementForm, auditRating: value })}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Satisfactory">Satisfactory</SelectItem>
                        <SelectItem value="Needs Improvement">Needs Improvement</SelectItem>
                        <SelectItem value="Unsatisfactory">Unsatisfactory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Audit Type</Label>
                    <Select
                      value={engagementForm.auditType}
                      onValueChange={(value) => setEngagementForm({ ...engagementForm, auditType: value })}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Internal Audit">Internal Audit</SelectItem>
                        <SelectItem value="Compliance Audit">Compliance Audit</SelectItem>
                        <SelectItem value="Financial Audit">Financial Audit</SelectItem>
                        <SelectItem value="Operational Audit">Operational Audit</SelectItem>
                        <SelectItem value="IT Audit">IT Audit</SelectItem>
                        <SelectItem value="Assurance">Assurance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Two columns for Auditor and Auditee */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      Auditor <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={engagementForm.auditorId}
                      onValueChange={(value) => setEngagementForm({ ...engagementForm, auditorId: value })}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select auditor" />
                      </SelectTrigger>
                      <SelectContent>
                        {auditors.length > 0 ? (
                          auditors.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No auditors available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Auditee</Label>
                    <Select
                      value={engagementForm.auditeeId}
                      onValueChange={(value) => setEngagementForm({ ...engagementForm, auditeeId: value })}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select auditee" />
                      </SelectTrigger>
                      <SelectContent>
                        {auditees.length > 0 ? (
                          auditees.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No auditees available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Two columns for Start Date and Target Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      Start Date <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      value={engagementForm.startDate}
                      onChange={(date) => setEngagementForm({ ...engagementForm, startDate: date ? date.toISOString().split('T')[0] : "" })}
                      placeholder="Select start date"
                      className="w-full h-10 bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">
                      Target Date <span className="text-red-500">*</span>
                    </Label>
                    <DatePicker
                      value={engagementForm.targetDate}
                      onChange={(date) => setEngagementForm({ ...engagementForm, targetDate: date ? date.toISOString().split('T')[0] : "" })}
                      placeholder="Select target date"
                      className="w-full h-10 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEngagement}
              disabled={saving || addDialogLoading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
