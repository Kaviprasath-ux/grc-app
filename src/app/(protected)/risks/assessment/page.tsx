"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions, useUserRoles } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
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
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import Link from "next/link";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskRating: string;
  category: { id: string; name: string } | null;
  owner: { id: string; fullName: string } | null;
  type: { id: string; name: string } | null;
  assessmentStatus: string;
  threats?: { threat: { id: string; name: string } }[];
  vulnerabilities?: { vulnerability: { id: string; name: string } }[];
  riskSources?: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface RiskType {
  id: string;
  name: string;
}

interface RiskRatingThreshold {
  min: number;
  max: number;
  rating: string;
  color: string;
}

interface RiskSettings {
  rating_matrix: {
    thresholds: RiskRatingThreshold[];
  };
}

const defaultRatingThresholds: RiskRatingThreshold[] = [
  { min: 1, max: 9, rating: "Low Risk", color: "#22c55e" },
  { min: 10, max: 14, rating: "High", color: "#f59e0b" },
  { min: 15, max: 19, rating: "Very high", color: "#ea580c" },
  { min: 20, max: 25, rating: "Catastrophic", color: "#dc2626" },
];

export default function RiskAssessmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const { canView, canCreate, canEdit, isLoading: permissionsLoading } = usePermissions('risk.assessment');
  const userRoles = useUserRoles();

  // Check if user can approve assessments (Reviewer, DepartmentReviewer, CustomerAdministrator, GRCAdministrator)
  const canApprove = userRoles.some(role =>
    ['Reviewer', 'DepartmentReviewer', 'CustomerAdministrator', 'GRCAdministrator'].includes(role)
  );
  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [loading, setLoading] = useState(true);


  // Dynamic settings from API
  const [ratingThresholds, setRatingThresholds] = useState<RiskRatingThreshold[]>(defaultRatingThresholds);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    try {
      const [risksRes, categoriesRes, typesRes, settingsRes] = await Promise.all([
        fetch("/api/risks"),
        fetch("/api/risk-categories"),
        fetch("/api/risk-types"),
        fetch("/api/risk-settings"),
      ]);

      if (risksRes.ok) {
        const data = await risksRes.json();
        setRisks(data.data || []);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data);
      }
      if (typesRes.ok) {
        const data = await typesRes.json();
        setRiskTypes(data);
      }

      // Parse risk settings
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const defaults = settingsData.defaults as RiskSettings | undefined;

        if (defaults) {
          // Set rating thresholds from settings
          if (defaults.rating_matrix?.thresholds && defaults.rating_matrix.thresholds.length > 0) {
            setRatingThresholds(defaults.rating_matrix.thresholds);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter risks
  const filteredRisks = risks.filter((risk) => {
    const matchesSearch =
      searchTerm === "" ||
      risk.riskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      risk.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || (risk.assessmentStatus || "Open") === statusFilter;

    const matchesRating =
      ratingFilter === "all" || risk.riskRating === ratingFilter;

    const matchesCategory =
      categoryFilter === "all" || risk.category?.id === categoryFilter;

    const matchesType =
      typeFilter === "all" || risk.type?.id === typeFilter;

    return matchesSearch && matchesStatus && matchesRating && matchesCategory && matchesType;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRisks.length / pageSize);
  const paginatedRisks = filteredRisks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getActionButton = (risk: Risk) => {
    const status = risk.assessmentStatus || "Open";
    switch (status) {
      case "Approved":
      case "Completed":
      case "Submitted":
      case "Rejected":
        // Users with create permission can re-assess completed risks
        return canCreate ? (
          <Button size="sm" variant="outline" onClick={() => openAssessment(risk)}>
            Re-assess
          </Button>
        ) : null;
      case "Draft":
      case "In-Progress":
        // Users with edit permission can continue working
        return canEdit ? (
          <Button size="sm" variant="outline" onClick={() => openAssessment(risk)}>
            Resume
          </Button>
        ) : null;
      default:
        // Open status - users with create permission can initiate
        return canCreate ? (
          <Button size="sm" onClick={() => openAssessment(risk)}>
            Initiate
          </Button>
        ) : null;
    }
  };

  const handleApprove = async (riskId: string) => {
    try {
      // Find the latest assessment for this risk and approve it
      const response = await fetch(`/api/risks/${riskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentStatus: "Approved",
        }),
      });

      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        console.error("Failed to approve:", error);
      }
    } catch (error) {
      console.error("Failed to approve assessment:", error);
    }
  };

  const handleReject = async (riskId: string) => {
    try {
      const response = await fetch(`/api/risks/${riskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentStatus: "Rejected",
        }),
      });

      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        console.error("Failed to reject:", error);
      }
    } catch (error) {
      console.error("Failed to reject assessment:", error);
    }
  };

  const openAssessment = (risk: Risk) => {
    router.push(`/risks/assessment/${risk.id}`);
  };

  // Show loading state while permissions or data is being fetched
  if (permissionsLoading || loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>Risk Management</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">Assessment</span>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800">Risk Assessment</h1>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Risk Assessment." />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Risk Management</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Assessment</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Risk Assessment</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search risks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[200px] bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-white">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Assessment Pending">Assessment Pending</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In-Progress">In-Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Awaiting Approval">Awaiting Approval</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="All Ratings" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Ratings</SelectItem>
            {ratingThresholds.map((threshold) => (
              <SelectItem key={threshold.rating} value={threshold.rating}>
                {threshold.rating}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px] bg-white">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Types</SelectItem>
            {riskTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="h-12 bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 pl-4">Risk ID</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Risk Name</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Risk Description</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Risk Rating</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Risk Category</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Risk Owner</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Risk Type</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRisks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                  No risks found
                </TableCell>
              </TableRow>
            ) : (
              paginatedRisks.map((risk) => (
                <TableRow key={risk.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 pl-4 font-medium text-slate-800">{risk.riskId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{risk.name}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700 max-w-[200px] truncate">{risk.description || "-"}</TableCell>
                  <TableCell className="py-3">
                    {risk.riskRating ? <RiskRatingBadge rating={risk.riskRating} /> : "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{risk.category?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{risk.owner?.fullName || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{risk.type?.name || "-"}</TableCell>
                  <TableCell className="py-3">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      (risk.assessmentStatus || "Open") === "Approved" && "bg-green-100 text-green-800",
                      (risk.assessmentStatus || "Open") === "Submitted" && "bg-purple-100 text-purple-800",
                      (risk.assessmentStatus || "Open") === "Draft" && "bg-slate-100 text-slate-800",
                      (risk.assessmentStatus || "Open") === "Rejected" && "bg-red-100 text-red-800",
                      (risk.assessmentStatus || "Open") === "In-Progress" && "bg-yellow-100 text-yellow-800",
                      (risk.assessmentStatus || "Open") === "Open" && "bg-blue-100 text-blue-800"
                    )}>
                      {risk.assessmentStatus || "Open"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1">
                      {getActionButton(risk)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {filteredRisks.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredRisks.length)} of {filteredRisks.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
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
