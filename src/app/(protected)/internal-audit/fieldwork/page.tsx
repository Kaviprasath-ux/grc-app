"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { Unauthorized } from "@/components/ui/unauthorized";
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
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  ArrowUpDown,
  Home,
  Eye,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import Link from "next/link";

interface Department {
  id: string;
  name: string;
}

interface Auditor {
  id: string;
  firstName: string;
  lastName: string;
}

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  department: Department | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assignedAuditor: Auditor | null;
  assignedAuditorId: string | null;
  assignedAuditors: string[];
}

export default function FieldworkPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { canView, isLoading: permissionsLoading } = usePermissions('audit.fieldwork');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [auditorFilter, setAuditorFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // View Dialog
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingEngagement, setViewingEngagement] = useState<Engagement | null>(null);

  // Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEngagement, setEditingEngagement] = useState<Engagement | null>(null);
  const [editForm, setEditForm] = useState({
    engagementTitle: "",
    departmentId: "",
    auditorId: "",
    startDate: null as Date | null,
    targetDate: null as Date | null,
    status: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchAuditors();
    fetchEngagements();
  }, []);

  useEffect(() => {
    fetchEngagements();
  }, [statusFilter, departmentFilter]);

  // Reset to first page when auditor filter changes (client-side filter)
  useEffect(() => {
    setCurrentPage(1);
  }, [auditorFilter]);

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

  const fetchAuditors = async () => {
    try {
      const response = await fetch("/api/users?role=Auditor");
      if (response.ok) {
        const data = await response.json();
        setAuditors(data.users || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch auditors:", error);
    }
  };

  const fetchEngagements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      // Note: auditorId filtering is done client-side

      const response = await fetch(`/api/internal-audit/engagements?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEngagements(data);
      }
    } catch (error) {
      console.error("Failed to fetch engagements:", error);
      toast.error(t("Failed to fetch fieldwork data"));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getAuditorName = (engagement: Engagement) => {
    if (engagement.assignedAuditor) {
      return `${engagement.assignedAuditor.firstName} ${engagement.assignedAuditor.lastName}`;
    }
    if (engagement.assignedAuditors && engagement.assignedAuditors.length > 0) {
      return engagement.assignedAuditors.join(", ");
    }
    return t("No items found");
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const openViewDialog = (engagement: Engagement) => {
    setViewingEngagement(engagement);
    setIsViewDialogOpen(true);
  };

  const openEditDialog = (engagement: Engagement) => {
    setEditingEngagement(engagement);
    setEditForm({
      engagementTitle: engagement.engagementTitle || "",
      departmentId: engagement.department?.id || "",
      auditorId: engagement.assignedAuditor?.id || engagement.assignedAuditorId || "",
      startDate: engagement.startDate ? new Date(engagement.startDate) : null,
      targetDate: engagement.endDate ? new Date(engagement.endDate) : null,
      status: engagement.status || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEngagement) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/internal-audit/engagements/${editingEngagement.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagementTitle: editForm.engagementTitle,
          departmentId: editForm.departmentId || null,
          auditorId: editForm.auditorId || null,
          startDate: editForm.startDate?.toISOString() || null,
          targetDate: editForm.targetDate?.toISOString() || null,
          status: editForm.status,
        }),
      });

      if (response.ok) {
        toast.success(t("Engagement updated successfully"));
        setIsEditDialogOpen(false);
        setEditingEngagement(null);
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to update engagement"));
      }
    } catch (error) {
      console.error("Error updating engagement:", error);
      toast.error(t("Failed to update engagement"));
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Planned":
        return "bg-blue-100 text-blue-700";
      case "In Progress":
        return "bg-yellow-100 text-yellow-700";
      case "Completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  // Filter by auditor (client-side) then sort
  const filteredEngagements = engagements.filter((engagement) => {
    if (auditorFilter === "all") return true;
    // Check if assignedAuditorId matches or if the auditor name is in assignedAuditors
    if (engagement.assignedAuditorId === auditorFilter) return true;
    if (engagement.assignedAuditor?.id === auditorFilter) return true;
    // Also check by auditor name in assignedAuditors array
    const selectedAuditor = auditors.find(a => a.id === auditorFilter);
    if (selectedAuditor) {
      const auditorName = `${selectedAuditor.firstName} ${selectedAuditor.lastName}`;
      if (engagement.assignedAuditors?.includes(auditorName)) return true;
    }
    return false;
  });

  const sortedEngagements = [...filteredEngagements].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: string | number = "";
    let bValue: string | number = "";

    switch (sortField) {
      case "auditId":
        aValue = a.auditId;
        bValue = b.auditId;
        break;
      case "name":
        aValue = a.engagementTitle;
        bValue = b.engagementTitle;
        break;
      case "auditor":
        aValue = getAuditorName(a);
        bValue = getAuditorName(b);
        break;
      case "startDate":
        aValue = a.startDate || "";
        bValue = b.startDate || "";
        break;
      case "targetDate":
        aValue = a.endDate || "";
        bValue = b.endDate || "";
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
    }

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedEngagements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedEngagements.slice(startIndex, endIndex);

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none hover:bg-slate-100"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
      </div>
    </TableHead>
  );

  // Show loading state while permissions or data is being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">{t("Fieldwork")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Fieldwork.")} />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Fieldwork")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Fieldwork")}</h1>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder={t("All Status")} />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">{t("All Status")}</SelectItem>
              <SelectItem value="Planned">{t("Planned")}</SelectItem>
              <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
              <SelectItem value="Completed">{t("Completed")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={auditorFilter} onValueChange={setAuditorFilter}>
            <SelectTrigger className="w-[160px] bg-white">
              <SelectValue placeholder={t("All Auditors")} />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">{t("All Auditors")}</SelectItem>
              {auditors.map((auditor) => (
                <SelectItem key={auditor.id} value={auditor.id}>
                  {auditor.firstName} {auditor.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder={t("All Departments")} />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">{t("All Departments")}</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {/* Action buttons would go here if needed */}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <SortableHeader field="auditId">{t("Audit ID")}</SortableHeader>
              <SortableHeader field="name">{t("Name")}</SortableHeader>
              <SortableHeader field="auditor">{t("Auditor")}</SortableHeader>
              <SortableHeader field="startDate">{t("Start Date")}</SortableHeader>
              <SortableHeader field="targetDate">{t("Target Date")}</SortableHeader>
              <SortableHeader field="status">{t("Status")}</SortableHeader>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-4 pl-4 text-sm font-medium text-slate-900">{engagement.auditId}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700 max-w-[200px] truncate">
                    {engagement.engagementTitle}
                  </TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{getAuditorName(engagement)}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{formatDate(engagement.startDate)}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{formatDate(engagement.endDate)}</TableCell>
                  <TableCell className="py-4 text-sm text-slate-700">{engagement.status}</TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => router.push(`/internal-audit/fieldwork/${engagement.id}?mode=view`)}
                        title={t("View Details")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => router.push(`/internal-audit/fieldwork/${engagement.id}?mode=edit`)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  {t("No fieldwork items found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {sortedEngagements.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {startIndex + 1} {t("to")} {Math.min(endIndex, sortedEngagements.length)} {t("of")} {sortedEngagements.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Engagement Details")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Content */}
          {viewingEngagement && (
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Audit ID */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end text-slate-500">{t("Audit ID")}</Label>
                <span className="text-sm text-slate-800">{viewingEngagement.auditId}</span>
              </div>

              {/* Engagement Title */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end text-slate-500">{t("Engagement Title")}</Label>
                <span className="text-sm text-slate-800">{viewingEngagement.engagementTitle}</span>
              </div>

              {/* Department */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end text-slate-500">{t("Department")}</Label>
                <span className="text-sm text-slate-800">{viewingEngagement.department?.name || "-"}</span>
              </div>

              {/* Auditor */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end text-slate-500">{t("Auditor")}</Label>
                <span className="text-sm text-slate-800">{getAuditorName(viewingEngagement)}</span>
              </div>

              {/* Start Date */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end text-slate-500">{t("Start Date")}</Label>
                <span className="text-sm text-slate-800">{formatDate(viewingEngagement.startDate)}</span>
              </div>

              {/* Target Date */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end text-slate-500">{t("Target Date")}</Label>
                <span className="text-sm text-slate-800">{formatDate(viewingEngagement.endDate)}</span>
              </div>

              {/* Status */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end text-slate-500">{t("Status")}</Label>
                <Badge className={`w-fit ${getStatusBadgeColor(viewingEngagement.status)}`}>
                  {viewingEngagement.status}
                </Badge>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsViewDialogOpen(false)}>
              {t("Close")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsViewDialogOpen(false);
                if (viewingEngagement) {
                  openEditDialog(viewingEngagement);
                }
              }}
            >
              <Pencil className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Edit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Engagement")}</DialogTitle>
            </DialogHeader>
          </div>
          {/* Scrollable Content */}
          {editingEngagement && (
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Audit ID - Read Only */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end">{t("Audit ID")}</Label>
                <span className="text-sm text-muted-foreground">{editingEngagement.auditId}</span>
              </div>

              {/* Engagement Title */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editEngagementTitle" className="text-end">{t("Engagement Title")}</Label>
                <Input
                  id="editEngagementTitle"
                  value={editForm.engagementTitle}
                  onChange={(e) => setEditForm({ ...editForm, engagementTitle: e.target.value })}
                  className="bg-white"
                />
              </div>

              {/* Department */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editDepartment" className="text-end">{t("Department")}</Label>
                <Select
                  value={editForm.departmentId}
                  onValueChange={(value) => setEditForm({ ...editForm, departmentId: value })}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select Department")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Auditor */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editAuditor" className="text-end">{t("Auditor")}</Label>
                <Select
                  value={editForm.auditorId}
                  onValueChange={(value) => setEditForm({ ...editForm, auditorId: value })}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select Auditor")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {auditors.map((auditor) => (
                      <SelectItem key={auditor.id} value={auditor.id}>
                        {auditor.firstName} {auditor.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end">{t("Start Date")}</Label>
                <DatePicker
                  value={editForm.startDate || undefined}
                  onChange={(date: Date | undefined) => setEditForm({ ...editForm, startDate: date || null })}
                />
              </div>

              {/* Target Date */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label className="text-end">{t("Target Date")}</Label>
                <DatePicker
                  value={editForm.targetDate || undefined}
                  onChange={(date: Date | undefined) => setEditForm({ ...editForm, targetDate: date || null })}
                />
              </div>

              {/* Status */}
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <Label htmlFor="editStatus" className="text-end">{t("Status")}</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select Status")} />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="Planned">{t("Planned")}</SelectItem>
                    <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
                    <SelectItem value="Completed">{t("Completed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={saving}
            >
              {saving && <Loader2 className="ltr:mr-2 rtl:ml-2 h-4 w-4 animate-spin" />}
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
