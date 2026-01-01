"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataGrid } from "@/components/shared";
import { RiskRatingBadge } from "@/components/risks/risk-rating-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { NewRiskWizard } from "@/components/risks/new-risk-wizard";
import { RiskDetailDialog } from "@/components/risks/risk-detail-dialog";
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
import { cn } from "@/lib/utils";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskSources: string | null;
  category: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; fullName: string; email: string } | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan?: string | null;
  treatmentDueDate?: string | null;
  treatmentStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  threats: { threat: { id: string; name: string } }[];
  vulnerabilities: { vulnerability: { id: string; name: string } }[];
  causes?: { cause: { id: string; name: string } }[];
}

interface Category {
  id: string;
  name: string;
}

interface RiskType {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface ActivityLog {
  id: string;
  activity: string;
  description: string | null;
  actor: string;
  createdAt: string;
  risk: { riskId: string; name: string };
}

interface Stats {
  totalRisks: number;
  openRisks: number;
  inProgressRisks: number;
  closedRisks: number;
}

function RiskRegisterContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const initialRating = searchParams.get("riskRating") || "";

  const [risks, setRisks] = useState<Risk[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalRisks: 0,
    openRisks: 0,
    inProgressRisks: 0,
    closedRisks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(initialRating || "all");
  const [statusFilter, setStatusFilter] = useState(initialStatus || "");

  // Dialog states
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editRiskData, setEditRiskData] = useState<Risk | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [riskToDelete, setRiskToDelete] = useState<Risk | null>(null);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLogsTotal, setActivityLogsTotal] = useState(0);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const fetchRisks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (categoryFilter && categoryFilter !== "all") params.append("categoryId", categoryFilter);
      if (typeFilter && typeFilter !== "all") params.append("typeId", typeFilter);
      if (ratingFilter && ratingFilter !== "all") params.append("riskRating", ratingFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/risks?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, typeFilter, ratingFilter, statusFilter]);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/risks/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/risk-categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const fetchRiskTypes = async () => {
    try {
      const response = await fetch("/api/risk-types");
      if (response.ok) {
        const data = await response.json();
        setRiskTypes(data);
      }
    } catch (error) {
      console.error("Failed to fetch risk types:", error);
    }
  };

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

  const fetchActivityLogs = async () => {
    try {
      const response = await fetch("/api/risks/activity-log?limit=100");
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data.data || []);
        setActivityLogsTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    }
  };

  useEffect(() => {
    fetchRisks();
    fetchStats();
    fetchCategories();
    fetchRiskTypes();
    fetchDepartments();
  }, [fetchRisks]);

  const handleViewRisk = (risk: Risk) => {
    setSelectedRisk(risk);
    setEditMode(false);
    setDetailOpen(true);
  };

  const handleEditRisk = (risk: Risk) => {
    setEditRiskData(risk);
    setWizardOpen(true);
  };

  const handleDeleteClick = (risk: Risk) => {
    setRiskToDelete(risk);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!riskToDelete) return;

    try {
      const response = await fetch(`/api/risks/${riskToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchRisks();
        fetchStats();
      }
    } catch (error) {
      console.error("Failed to delete risk:", error);
    } finally {
      setDeleteDialogOpen(false);
      setRiskToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/risks/export?format=csv");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Risk-Register.csv";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to export:", error);
    }
  };

  const handleActivityLogOpen = () => {
    fetchActivityLogs();
    setActivityLogOpen(true);
  };

  const handleStatusCardClick = (status: string) => {
    if (statusFilter === status) {
      setStatusFilter("");
    } else {
      setStatusFilter(status);
    }
  };

  const columns: ColumnDef<Risk>[] = [
    {
      accessorKey: "riskId",
      header: "Risk ID",
      cell: ({ row }) => (
        <span className="font-medium text-grc-primary">{row.getValue("riskId")}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Risk Name",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate" title={row.getValue("name")}>
          {row.getValue("name")}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Risk Description",
      cell: ({ row }) => (
        <div className="max-w-[250px] truncate" title={row.original.description || ""}>
          {row.original.description || "-"}
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Risk Category",
      cell: ({ row }) => {
        const category = row.original.category;
        return category?.name || "No items found";
      },
    },
    {
      accessorKey: "owner",
      header: "Risk Owner",
      cell: ({ row }) => {
        const owner = row.original.owner;
        return owner?.fullName || "No items found";
      },
    },
    {
      accessorKey: "riskRating",
      header: "Risk Rating",
      cell: ({ row }) => <RiskRatingBadge rating={row.getValue("riskRating")} />,
    },
    {
      accessorKey: "type",
      header: "Risk Type",
      cell: ({ row }) => {
        const type = row.original.type;
        return type?.name || "-";
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const risk = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleEditRisk(risk);
              }}
              className="h-8 w-8"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(risk);
              }}
              className="h-8 w-8 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Risk Management
          </div>
          <h1 className="text-2xl font-semibold text-grc-text">Risk Register</h1>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Risk
        </Button>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button variant="outline" onClick={handleActivityLogOpen} className="gap-2">
          <Activity className="h-4 w-4" />
          Activity Log
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="flex items-center gap-4">
        <div className="bg-white rounded-lg border p-4 min-w-[100px] text-center">
          <div className="text-2xl font-bold">{stats.totalRisks}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <button
          onClick={() => handleStatusCardClick("Open")}
          className={cn(
            "bg-white rounded-lg border p-4 min-w-[100px] text-center transition-all hover:border-red-300",
            statusFilter === "Open" && "border-red-500 ring-2 ring-red-200"
          )}
        >
          <div className="text-2xl font-bold text-red-600">{stats.openRisks}</div>
          <div className="text-sm text-muted-foreground">Open</div>
        </button>
        <button
          onClick={() => handleStatusCardClick("In Progress")}
          className={cn(
            "bg-white rounded-lg border p-4 min-w-[100px] text-center transition-all hover:border-amber-300",
            statusFilter === "In Progress" && "border-amber-500 ring-2 ring-amber-200"
          )}
        >
          <div className="text-2xl font-bold text-amber-600">{stats.inProgressRisks}</div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </button>
        <button
          onClick={() => handleStatusCardClick("Closed")}
          className={cn(
            "bg-white rounded-lg border p-4 min-w-[100px] text-center transition-all hover:border-green-300",
            statusFilter === "Closed" && "border-green-500 ring-2 ring-green-200"
          )}
        >
          <div className="text-2xl font-bold text-green-600">{stats.closedRisks}</div>
          <div className="text-sm text-muted-foreground">Closed</div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search By ID, Name, Risk Rating"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[180px]">
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
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Risk Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Risk Rating</SelectItem>
            <SelectItem value="Catastrophic">Catastrophic</SelectItem>
            <SelectItem value="Very high">Very high</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Low Risk">Low Risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grc-primary"></div>
        </div>
      ) : (
        <DataGrid
          columns={columns}
          data={risks}
          onRowClick={handleViewRisk}
          showColumnSelector
          pageSize={20}
        />
      )}

      {/* New/Edit Risk Wizard */}
      <NewRiskWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) setEditRiskData(null);
        }}
        onSuccess={() => {
          setWizardOpen(false);
          setEditRiskData(null);
          fetchRisks();
          fetchStats();
        }}
        categories={categories}
        departments={departments}
        editData={editRiskData}
      />

      {/* Risk Detail Dialog */}
      <RiskDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        risk={selectedRisk}
        editMode={editMode}
        onEditModeChange={setEditMode}
        onSuccess={() => {
          setDetailOpen(false);
          fetchRisks();
          fetchStats();
        }}
        categories={categories}
        departments={departments}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-grc-primary hover:bg-grc-primary/90"
            >
              OK
            </AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity Log Dialog */}
      <Dialog open={activityLogOpen} onOpenChange={setActivityLogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Activity Log</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-4">
            Showing {activityLogs.length} of {activityLogsTotal} activities
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Risk</th>
                  <th className="text-left p-3 font-medium">Activity</th>
                  <th className="text-left p-3 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activityLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-3 text-sm">
                      {new Date(log.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="p-3 text-sm font-medium text-grc-primary">
                      {log.risk.riskId}
                    </td>
                    <td className="p-3 text-sm">{log.activity}</td>
                    <td className="p-3 text-sm">{log.actor}</td>
                  </tr>
                ))}
                {activityLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No activity logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Risks</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file to import risks. Download the template first to see the required format.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch("/api/risks/export?format=csv");
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "Risk-Template.csv";
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    }
                  } catch (error) {
                    console.error("Failed to download template:", error);
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop your file here, or click to browse
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  // Handle file upload
                  const file = e.target.files?.[0];
                  if (file) {
                    // Process file
                    console.log("File selected:", file.name);
                  }
                }}
              />
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                Select File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RiskRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grc-primary"></div>
        </div>
      }
    >
      <RiskRegisterContent />
    </Suspense>
  );
}
