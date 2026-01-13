"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";

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
      className="text-white cursor-pointer hover:bg-[#1a365d] select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-4 w-4" />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f] mb-6">Fieldwork</h1>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-[#1e3a5f]">Fieldwork</h1>

      {/* Filters */}
      <div className="flex items-center justify-end gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Planned">Planned</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={auditorFilter} onValueChange={setAuditorFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Auditor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Auditor</SelectItem>
            {auditors.map((auditor) => (
              <SelectItem key={auditor.id} value={auditor.id}>
                {auditor.firstName} {auditor.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Select Department</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#1e3a5f] hover:bg-[#1e3a5f]">
              <SortableHeader field="auditId">Audit ID</SortableHeader>
              <SortableHeader field="name">Name</SortableHeader>
              <SortableHeader field="auditor">Auditor</SortableHeader>
              <SortableHeader field="startDate">Start Date</SortableHeader>
              <SortableHeader field="targetDate">Target Date</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <TableHead className="text-white">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((engagement) => (
                <TableRow key={engagement.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{engagement.auditId}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {engagement.engagementTitle}
                  </TableCell>
                  <TableCell>{getAuditorName(engagement)}</TableCell>
                  <TableCell>{formatDate(engagement.startDate)}</TableCell>
                  <TableCell>{formatDate(engagement.endDate)}</TableCell>
                  <TableCell>{engagement.status}</TableCell>
                  <TableCell>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                      onClick={() => router.push(`/internal-audit/fieldwork/${engagement.id}`)}
                    >
                      Add/View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  No fieldwork items found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {sortedEngagements.length > 0 && (
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
              {startIndex + 1} to {Math.min(endIndex, sortedEngagements.length)} of {sortedEngagements.length}
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
    </div>
  );
}
