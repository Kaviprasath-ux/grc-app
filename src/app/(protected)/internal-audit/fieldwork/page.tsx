"use client";

import { useState, useEffect } from "react";
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
  ChevronRight,
  ArrowUpDown,
  Home,
  Eye,
  Pencil,
  Search,
} from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
import Link from "next/link";
import { FieldworkDetailModal } from "./FieldworkDetailModal";

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
  const { t } = useLanguage();
  const { canView, isLoading: permissionsLoading } = usePermissions('audit.fieldwork');
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [auditorFilter, setAuditorFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    fetchDepartments();
    fetchAuditors();
    fetchEngagements();
  }, []);

  useEffect(() => {
    fetchEngagements();
  }, [statusFilter, departmentFilter]);

  // Reset to first page when client-side filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [auditorFilter, searchFilter]);

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

  // Filter by search and auditor (client-side) then sort
  const filteredEngagements = engagements.filter((engagement) => {
    // Search filter
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      const matchesSearch =
        engagement.auditId?.toLowerCase().includes(search) ||
        engagement.engagementTitle?.toLowerCase().includes(search) ||
        getAuditorName(engagement).toLowerCase().includes(search) ||
        engagement.department?.name?.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Auditor filter
    if (auditorFilter !== "all") {
      if (engagement.assignedAuditorId === auditorFilter) return true;
      if (engagement.assignedAuditor?.id === auditorFilter) return true;
      const selectedAuditor = auditors.find(a => a.id === auditorFilter);
      if (selectedAuditor) {
        const auditorName = `${selectedAuditor.firstName} ${selectedAuditor.lastName}`;
        if (engagement.assignedAuditors?.includes(auditorName)) return true;
      }
      return false;
    }

    return true;
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

  const SortableHeader = ({ field, children, className: extraClass }: { field: string; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer select-none whitespace-nowrap ${extraClass || ""}`}
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
      <div className="space-y-4 sm:space-y-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Fieldwork")}</h1>
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
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="text-primary-700 font-medium">{t("Fieldwork")}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Fieldwork")}</h1>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search engagements...")}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
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
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
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
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm bg-slate-50 border-slate-200">
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
        </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <SortableHeader field="auditId" className="pl-5">{t("Audit ID")}</SortableHeader>
              <SortableHeader field="name">{t("Name")}</SortableHeader>
              <SortableHeader field="auditor">{t("Auditor")}</SortableHeader>
              <SortableHeader field="startDate">{t("Start Date")}</SortableHeader>
              <SortableHeader field="targetDate">{t("Target Date")}</SortableHeader>
              <SortableHeader field="status">{t("Status")}</SortableHeader>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 whitespace-nowrap pr-5">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-5 whitespace-nowrap">{engagement.auditId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 max-w-[200px] truncate">
                    {engagement.engagementTitle}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{getAuditorName(engagement)}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{formatDate(engagement.startDate)}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 whitespace-nowrap">{formatDate(engagement.endDate)}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.status}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      {engagement.status === "Completed" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => { setSelectedEngagementId(engagement.id); setSelectedMode("view"); setDetailModalOpen(true); }}
                          title={t("View Details")}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={() => { setSelectedEngagementId(engagement.id); setSelectedMode("edit"); setDetailModalOpen(true); }}
                          title={t("Edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                  {t("No fieldwork items found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <PaginationUI
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedEngagements.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Fieldwork Detail Modal */}
      <FieldworkDetailModal
        open={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedEngagementId(null); fetchEngagements(); }}
        engagementId={selectedEngagementId}
        mode={selectedMode}
      />
    </div>
  );
}
