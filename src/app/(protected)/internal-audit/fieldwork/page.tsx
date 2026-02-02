"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
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
} from "lucide-react";
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
  const { data: session } = useSession();
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
      toast.error("Failed to fetch fieldwork data");
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
    return "No items found";
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
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
        <h1 className="text-2xl font-bold text-slate-800">Fieldwork</h1>
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

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Fieldwork." />;
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
        <span className="text-primary-700 font-medium">Fieldwork</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Fieldwork</h1>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-end gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Planned">Planned</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={auditorFilter} onValueChange={setAuditorFilter}>
          <SelectTrigger className="w-[160px] bg-white">
            <SelectValue placeholder="All Auditors" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Auditors</SelectItem>
            {auditors.map((auditor) => (
              <SelectItem key={auditor.id} value={auditor.id}>
                {auditor.firstName} {auditor.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <SortableHeader field="auditId">Audit ID</SortableHeader>
              <SortableHeader field="name">Name</SortableHeader>
              <SortableHeader field="auditor">Auditor</SortableHeader>
              <SortableHeader field="startDate">Start Date</SortableHeader>
              <SortableHeader field="targetDate">Target Date</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">Action</TableHead>
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
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-primary-600 hover:bg-primary-700 text-white"
                      onClick={() => router.push(`/internal-audit/fieldwork/${engagement.id}`)}
                    >
                      Add/View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No fieldwork items found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {sortedEngagements.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {startIndex + 1} to {Math.min(endIndex, sortedEngagements.length)} of {sortedEngagements.length}
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
    </div>
  );
}
