"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Pencil, Trash2, ArrowUpDown, Eye, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Department {
  id: string;
  name: string;
}

interface AuditCategory {
  id: string;
  name: string;
}

interface InternalAuditRisk {
  id: string;
  riskId: string;
  riskName: string;
  riskDescription: string | null;
  departmentId: string | null;
  department: Department | null;
  categoryId: string | null;
  category: AuditCategory | null;
  creationDate: string;
  inherentScore: number | null;
  residualScore: number | null;
  riskLevel: string | null;
  status: string;
}

export default function RiskRegisterPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [risks, setRisks] = useState<InternalAuditRisk[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Check if user has read-only role (DepartmentReviewer or DepartmentContributor)
  // These roles should see the page in read-only mode per UAT requirements
  const isReadOnlyRole = session?.user?.roles?.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  ) ?? false;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InternalAuditRisk | null>(null);

  // Generate year options (current year + 5 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  useEffect(() => {
    fetchDepartments();
    fetchRisks();
  }, []);

  useEffect(() => {
    fetchRisks();
  }, [yearFilter, departmentFilter, searchFilter]);

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

  const fetchRisks = async () => {
    try {
      const params = new URLSearchParams();
      if (yearFilter && yearFilter !== "all") params.append("year", yearFilter);
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await fetch(`/api/internal-audit/risks?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (item: InternalAuditRisk) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/risks/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchRisks();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const getRiskLevelBadge = (level: string | null) => {
    if (!level) return null;

    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Low: "secondary",
      Medium: "default",
      High: "destructive",
      Extreme: "destructive",
    };

    return <Badge variant={variants[level] || "outline"}>{level}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Open: "default",
      Closed: "secondary",
      "Under Review": "outline",
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Internal Audit</p>
            <h1 className="text-2xl font-semibold">Risk Register</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Internal Audit</p>
            <h1 className="text-2xl font-semibold">Risk Register</h1>
          </div>
        </div>
        {!isReadOnlyRole && (
          <Button onClick={() => router.push("/internal-audit/risk-register/add")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Risk Manually
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Select value={yearFilter} onValueChange={setYearFilter} disabled={isReadOnlyRole}>
              <SelectTrigger disabled={isReadOnlyRole}>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isReadOnlyRole}>
              <SelectTrigger disabled={isReadOnlyRole}>
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
          </div>
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Risk ID, Name, or Description..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-10"
                disabled={isReadOnlyRole}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risk ID</TableHead>
              <TableHead>Risk Description</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Creation Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Inherent Score</TableHead>
              <TableHead>Residual Score</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Status</TableHead>
              {!isReadOnlyRole && <TableHead className="w-[120px]">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((risk) => (
              <TableRow key={risk.id}>
                <TableCell className="font-medium">{risk.riskId}</TableCell>
                <TableCell className="max-w-[200px] truncate">{risk.riskDescription || risk.riskName}</TableCell>
                <TableCell>{risk.department?.name || "-"}</TableCell>
                <TableCell>{formatDate(risk.creationDate)}</TableCell>
                <TableCell>{risk.category?.name || "-"}</TableCell>
                <TableCell>{risk.inherentScore ?? "-"}</TableCell>
                <TableCell>{risk.residualScore ?? "-"}</TableCell>
                <TableCell>{getRiskLevelBadge(risk.riskLevel)}</TableCell>
                <TableCell>{getStatusBadge(risk.status)}</TableCell>
                {!isReadOnlyRole && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/internal-audit/risk-register/${risk.id}`)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/internal-audit/risk-register/${risk.id}/edit`)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(risk)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {risks.length === 0 && (
              <TableRow>
                <TableCell colSpan={isReadOnlyRole ? 9 : 10} className="text-center py-8 text-muted-foreground">
                  {isReadOnlyRole ? "No risks found." : "No risks found. Click \"Add Risk Manually\" to create your first risk."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination info */}
        <div className="flex items-center justify-end p-4 border-t text-sm text-muted-foreground">
          Currently showing 1 to {risks.length} of {risks.length}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this risk?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>OK</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
