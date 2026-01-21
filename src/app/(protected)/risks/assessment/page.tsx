"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared";
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
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

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
        <PageHeader title="Risk Assessment" description="Assess and evaluate risks" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
      <PageHeader
        title="Risk Assessment"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search By Risk ID, Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status</SelectItem>
            <SelectItem value="Assessment Pending">Assessment Pending</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="In-Progress">In-Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Awaiting Approval">Awaiting Approval</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Risk Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Risk Rating</SelectItem>
            {ratingThresholds.map((threshold) => (
              <SelectItem key={threshold.rating} value={threshold.rating}>
                {threshold.rating}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Category</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Risk type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Risk type</SelectItem>
            {riskTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Grid */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk ID <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Name <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Description <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Rating <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Category <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Risk Owner <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  RiskType <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer">
                <div className="flex items-center gap-1">
                  Status <ArrowUpDown className="h-4 w-4" />
                </div>
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRisks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No risks found
                </TableCell>
              </TableRow>
            ) : (
              paginatedRisks.map((risk) => (
                <TableRow key={risk.id}>
                  <TableCell className="font-medium">{risk.riskId}</TableCell>
                  <TableCell>{risk.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{risk.description}</TableCell>
                  <TableCell>
                    {risk.riskRating ? <RiskRatingBadge rating={risk.riskRating} /> : "-"}
                  </TableCell>
                  <TableCell>{risk.category?.name || "-"}</TableCell>
                  <TableCell>{risk.owner?.fullName || "No items found"}</TableCell>
                  <TableCell>{risk.type?.name || "-"}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      (risk.assessmentStatus || "Open") === "Approved" && "bg-green-100 text-green-800",
                      (risk.assessmentStatus || "Open") === "Submitted" && "bg-purple-100 text-purple-800",
                      (risk.assessmentStatus || "Open") === "Draft" && "bg-gray-100 text-gray-800",
                      (risk.assessmentStatus || "Open") === "Rejected" && "bg-red-100 text-red-800",
                      (risk.assessmentStatus || "Open") === "In-Progress" && "bg-yellow-100 text-yellow-800",
                      (risk.assessmentStatus || "Open") === "Open" && "bg-blue-100 text-blue-800"
                    )}>
                      {risk.assessmentStatus || "Open"}
                    </span>
                  </TableCell>
                  <TableCell>{getActionButton(risk)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Currently showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredRisks.length)} of {filteredRisks.length}
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <ChevronLeft className="h-4 w-4 -ml-2" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
            <ChevronRight className="h-4 w-4 -ml-2" />
          </Button>
        </div>
      </div>

    </div>
  );
}
