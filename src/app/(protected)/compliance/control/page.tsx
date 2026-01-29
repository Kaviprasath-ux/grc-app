"use client";

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Trash2,
  ArrowUpDown,
  Settings2,
  Download,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Search,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description?: string;
  controlQuestion?: string;
  functionalGrouping?: string;
  status: string;
  domain?: { id: string; name: string; code?: string };
  framework?: { id: string; name: string };
  department?: { id: string; name: string };
  owner?: { id: string; fullName: string };
  assignee?: { id: string; fullName: string };
}

interface Department {
  id: string;
  name: string;
}

interface ControlDomain {
  id: string;
  name: string;
  code?: string;
}

interface Framework {
  id: string;
  name: string;
}

interface UserRole {
  role: {
    name: string;
  };
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
  customerCode?: string;
  userRoles?: UserRole[];
}

interface CurrentUser {
  id: string;
  customerCode?: string;
}

const FUNCTIONAL_GROUPINGS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

const ITEMS_PER_PAGE = 20;

// Colors for functional grouping donut chart (matching the image)
const FUNCTIONAL_GROUPING_COLORS: Record<string, string> = {
  "Govern": "#3B82F6",    // Blue
  "Identify": "#F97316",  // Orange
  "Protect": "#22C55E",   // Green
  "Detect": "#EF4444",    // Red
  "Respond": "#A855F7",   // Purple
  "Recover": "#78716C",   // Brown/Gray
};

// Colors for compliance status (matching the image)
const COMPLIANCE_STATUS_COLORS = {
  "Not-Applicable": "#22C55E",  // Green
  "Compliant": "#F97316",       // Orange
  "Non-Compliant": "#3B82F6",   // Blue
};

function ControlListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { toast } = useToast();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.controls');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const [activeTab, setActiveTab] = useState<"all-controls" | "dashboard">("all-controls");
  const [controls, setControls] = useState<Control[]>([]);
  const [allControlsForDashboard, setAllControlsForDashboard] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Filters - initialize from URL query parameter
  const [integratedFrameworkFilter, setIntegratedFrameworkFilter] = useState<string>(
    searchParams.get("frameworkId") || "all"
  );
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [functionalGroupingFilter, setFunctionalGroupingFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    controlCode: true,
    controlName: true,
    functionalGrouping: true,
    status: true,
    owner: true,
    domain: true,
  });

  // Filter options
  const [departments, setDepartments] = useState<Department[]>([]);
  const [domains, setDomains] = useState<ControlDomain[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newControl, setNewControl] = useState({
    name: "",
    description: "",
    controlQuestion: "",
    functionalGrouping: "",
    domainId: "",
    departmentId: "",
    ownerId: "",
    assigneeId: "",
  });

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Delete all confirmation
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, [session?.user?.id]);

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, domainRes, frameworkRes, userRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/control-domains"),
        fetch("/api/frameworks"),
        fetch("/api/users"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (domainRes.ok) setDomains(await domainRes.json());
      if (frameworkRes.ok) setFrameworks(await frameworkRes.json());
      if (userRes.ok) {
        const userData = await userRes.json();
        setUsers(userData);

        // Find current user to get customerCode for customer scoping
        if (session?.user?.id) {
          const currentUserData = userData.find((u: User) => u.id === session.user.id);
          if (currentUserData) {
            setCurrentUser({
              id: currentUserData.id,
              customerCode: currentUserData.customerCode,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchControls = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", (currentPage + 1).toString());
      params.set("limit", ITEMS_PER_PAGE.toString());
      if (integratedFrameworkFilter && integratedFrameworkFilter !== "all") {
        params.set("frameworkId", integratedFrameworkFilter);
      }
      if (domainFilter && domainFilter !== "all") {
        params.set("domainId", domainFilter);
      }
      if (departmentFilter && departmentFilter !== "all") {
        params.set("departmentId", departmentFilter);
      }
      if (assigneeFilter && assigneeFilter !== "all") {
        params.set("assigneeId", assigneeFilter);
      }
      if (functionalGroupingFilter && functionalGroupingFilter !== "all") {
        params.set("functionalGrouping", functionalGroupingFilter);
      }
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (search) params.set("search", search);

      const response = await fetch(`/api/controls?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setControls(data.data || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, integratedFrameworkFilter, domainFilter, departmentFilter, assigneeFilter, functionalGroupingFilter, statusFilter, search]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  // Fetch all controls for dashboard (without pagination)
  const fetchAllControlsForDashboard = useCallback(async () => {
    if (!isCustomerAdmin) return;
    try {
      const response = await fetch(`/api/controls?limit=10000`);
      if (response.ok) {
        const data = await response.json();
        setAllControlsForDashboard(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching all controls for dashboard:", error);
    }
  }, [isCustomerAdmin]);

  useEffect(() => {
    if (isCustomerAdmin) {
      fetchAllControlsForDashboard();
    }
  }, [isCustomerAdmin, fetchAllControlsForDashboard]);

  // Dashboard data computations
  const functionalGroupingData = useMemo(() => {
    const counts: Record<string, number> = {};
    FUNCTIONAL_GROUPINGS.forEach(g => counts[g] = 0);

    allControlsForDashboard.forEach(control => {
      const grouping = control.functionalGrouping || "";
      if (grouping && counts.hasOwnProperty(grouping)) {
        counts[grouping]++;
      }
    });

    return FUNCTIONAL_GROUPINGS.map(name => ({
      name,
      value: counts[name],
      color: FUNCTIONAL_GROUPING_COLORS[name] || "#94A3B8",
    }));
  }, [allControlsForDashboard]);

  const totalControls = useMemo(() => {
    return allControlsForDashboard.length;
  }, [allControlsForDashboard]);

  const frameworkComplianceData = useMemo(() => {
    // Group controls by framework and calculate compliance percentages
    const frameworkMap: Record<string, { name: string; notApplicable: number; compliant: number; nonCompliant: number; total: number }> = {};

    allControlsForDashboard.forEach(control => {
      const frameworkName = control.framework?.name || "Unassigned";
      if (!frameworkMap[frameworkName]) {
        frameworkMap[frameworkName] = { name: frameworkName, notApplicable: 0, compliant: 0, nonCompliant: 0, total: 0 };
      }
      frameworkMap[frameworkName].total++;

      const status = control.status?.toLowerCase() || "";
      if (status === "not applicable" || status === "not-applicable") {
        frameworkMap[frameworkName].notApplicable++;
      } else if (status === "compliant" || status === "implemented") {
        frameworkMap[frameworkName].compliant++;
      } else {
        frameworkMap[frameworkName].nonCompliant++;
      }
    });

    // Convert to percentage-based data for stacked bar chart
    return Object.values(frameworkMap)
      .filter(f => f.name !== "Unassigned")
      .slice(0, 6) // Show top 6 frameworks
      .map(f => ({
        name: f.name.length > 6 ? f.name.substring(0, 5) + ".." : f.name,
        fullName: f.name,
        "Not-Applicable": f.total > 0 ? Math.round((f.notApplicable / f.total) * 100) : 0,
        "Compliant": f.total > 0 ? Math.round((f.compliant / f.total) * 100) : 0,
        "Non-Compliant": f.total > 0 ? Math.round((f.nonCompliant / f.total) * 100) : 0,
      }));
  }, [allControlsForDashboard]);

  // Stats for All Controls tab cards
  const controlStats = useMemo(() => {
    let nonCompliant = 0;
    let compliant = 0;
    let notApplicable = 0;

    allControlsForDashboard.forEach(control => {
      const status = control.status?.toLowerCase() || "";
      if (status === "not applicable" || status === "not-applicable") {
        notApplicable++;
      } else if (status === "compliant" || status === "implemented") {
        compliant++;
      } else {
        nonCompliant++;
      }
    });

    return {
      total: allControlsForDashboard.length,
      nonCompliant,
      compliant,
      notApplicable,
    };
  }, [allControlsForDashboard]);

  const handleSearch = () => {
    setCurrentPage(0);
    fetchControls();
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedControls = [...controls].sort((a, b) => {
    let aValue = "";
    let bValue = "";

    switch (sortField) {
      case "name":
        aValue = a.name || "";
        bValue = b.name || "";
        break;
      case "controlCode":
        aValue = a.controlCode || "";
        bValue = b.controlCode || "";
        break;
      case "functionalGrouping":
        aValue = a.functionalGrouping || "";
        bValue = b.functionalGrouping || "";
        break;
      case "status":
        aValue = a.status || "";
        bValue = b.status || "";
        break;
      case "domain":
        aValue = a.domain?.name || "";
        bValue = b.domain?.name || "";
        break;
      default:
        aValue = a.name || "";
        bValue = b.name || "";
    }

    if (sortDirection === "asc") {
      return aValue.localeCompare(bValue);
    }
    return bValue.localeCompare(aValue);
  });

  // Pagination
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, total);

  const handleImport = () => {
    setIsImportDialogOpen(true);
    setImportFile(null);
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/controls/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        toast({ title: "Success", description: `Successfully imported ${result.imported} control(s)` });
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchControls();
      } else {
        const error = await response.json();
        toast({ title: "Error", description: `Import failed: ${error.message || "Unknown error"}`, variant: "destructive" });
      }
    } catch (error) {
      console.error("Error importing controls:", error);
      toast({ title: "Error", description: "Failed to import controls", variant: "destructive" });
    } finally {
      setImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ["Control Code", "Control Name", "Description", "Control Question", "Functional Grouping", "Domain", "Department", "Owner", "Assignee", "Status"];
    const csvContent = headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "control-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/api/controls/delete-all", {
        method: "DELETE",
      });

      if (response.ok) {
        setIsDeleteAllDialogOpen(false);
        fetchControls();
      } else {
        toast({ title: "Error", description: "Failed to delete controls", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting controls:", error);
      toast({ title: "Error", description: "Failed to delete controls", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateControl = async () => {
    try {
      const response = await fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newControl),
      });
      if (response.ok) {
        toast({ title: "Success", description: "Control created successfully" });
        setIsCreateDialogOpen(false);
        setCreateStep(1);
        setNewControl({
          name: "",
          description: "",
          controlQuestion: "",
          functionalGrouping: "",
          domainId: "",
          departmentId: "",
          ownerId: "",
          assigneeId: "",
        });
        fetchControls();
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to create control",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating control:", error);
      toast({
        title: "Error",
        description: "Failed to create control",
        variant: "destructive"
      });
    }
  };

  // The /api/users and /api/departments endpoints already apply tenant filtering,
  // so data is already scoped to the user's customerAccountId.
  const getCustomerScopedUsers = () => users;

  const getCustomerScopedDepartments = () => departments;

  // Filter users for Assignee dropdown: only DepartmentReviewers and DepartmentContributors from the selected department
  const getFilteredUsersForAssignee = () => {
    if (!newControl.departmentId) return [];

    return users.filter((u) => {
      if (u.departmentId !== newControl.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  };

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Controls." />;
  }

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Controls</h3>
          <div className="flex items-center gap-2">
            {/* Show New Control button for Customer Admin or users with create permission */}
            {isCustomerAdmin ? (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Control
              </Button>
            ) : (
              <PermissionGate resource="compliance.controls" action="create">
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Control
                </Button>
              </PermissionGate>
            )}
            <PermissionGate resource="compliance.controls" action="create">
              <Button onClick={handleImport} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </PermissionGate>
            <PermissionGate resource="compliance.controls" action="delete">
              <Button
                onClick={() => setIsDeleteAllDialogOpen(true)}
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All
              </Button>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Tabs - Dashboard tab only visible for CustomerAdministrator */}
      {isCustomerAdmin && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("all-controls")}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "all-controls"
                ? "bg-white text-blue-700 border border-gray-200 shadow-sm"
                : "bg-[#1e1b4b] text-white"
            }`}
          >
            All Controls
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-5 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "dashboard"
                ? "bg-white text-blue-700 border border-gray-200 shadow-sm"
                : "bg-[#1e1b4b] text-white"
            }`}
          >
            Dashboard
          </button>
        </div>
      )}

      {/* Dashboard Tab Content */}
      {activeTab === "dashboard" && isCustomerAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Functional Grouping Donut Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-xl font-semibold text-[#1e3a8a] mb-6">Functional Grouping</h3>
            <div className="flex flex-col items-center">
              {/* Donut Chart */}
              <div className="relative w-[280px] h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={functionalGroupingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={130}
                      paddingAngle={1}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {functionalGroupingData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        fontSize: "12px",
                        padding: "8px 12px",
                      }}
                      formatter={(value, name) => [`${value}`, name as string]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-3xl font-bold text-gray-800">{totalControls}</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
                {functionalGroupingData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By Framework Stacked Bar Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-xl font-semibold text-[#1e3a8a] mb-6">By Framework</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={frameworkComplianceData}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  barCategoryGap="20%"
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={50}
                    tick={{ fontSize: 11, fill: "#374151" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                    formatter={(value, name, props) => [`${value}%`, name as string]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar
                    dataKey="Non-Compliant"
                    stackId="a"
                    fill={COMPLIANCE_STATUS_COLORS["Non-Compliant"]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="Compliant"
                    stackId="a"
                    fill={COMPLIANCE_STATUS_COLORS["Compliant"]}
                    barSize={20}
                  />
                  <Bar
                    dataKey="Not-Applicable"
                    stackId="a"
                    fill={COMPLIANCE_STATUS_COLORS["Not-Applicable"]}
                    barSize={20}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COMPLIANCE_STATUS_COLORS["Not-Applicable"] }} />
                <span className="text-sm text-gray-600">Not-Applicable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COMPLIANCE_STATUS_COLORS["Compliant"] }} />
                <span className="text-sm text-gray-600">Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COMPLIANCE_STATUS_COLORS["Non-Compliant"] }} />
                <span className="text-sm text-gray-600">Non-Compliant</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Controls Tab Content */}
      {activeTab === "all-controls" && (
        <>
      {/* Integrated Framework Filter - Top Right */}
      <div className="flex justify-end">
        <Select value={integratedFrameworkFilter} onValueChange={(v) => { setIntegratedFrameworkFilter(v); setCurrentPage(0); }}>
          <SelectTrigger className="w-[200px] border-blue-600">
            <SelectValue placeholder="Integrated Framework" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Integrated Framework</SelectItem>
            {frameworks.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Controls Card */}
        <div
          onClick={() => { setStatusFilter("all"); setCurrentPage(0); }}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] p-6 text-white cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${statusFilter === "all" ? "ring-2 ring-white/50" : ""}`}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-white/80" />
            </div>
            <span className="text-4xl font-bold mb-1">{controlStats.total}</span>
            <span className="text-sm text-white/80">Total Controls</span>
          </div>
        </div>

        {/* Non Compliant Card */}
        <div
          onClick={() => { setStatusFilter("Non Compliant"); setCurrentPage(0); }}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] p-6 text-white cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${statusFilter === "Non Compliant" ? "ring-2 ring-white/50" : ""}`}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-white/80" />
            </div>
            <span className="text-4xl font-bold mb-1">{controlStats.nonCompliant}</span>
            <span className="text-sm text-white/80">Non Compliant</span>
          </div>
        </div>

        {/* Compliant Card */}
        <div
          onClick={() => { setStatusFilter("Compliant"); setCurrentPage(0); }}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] p-6 text-white cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${statusFilter === "Compliant" ? "ring-2 ring-white/50" : ""}`}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
              <CheckCircle className="w-7 h-7 text-white/80" />
            </div>
            <span className="text-4xl font-bold mb-1">{controlStats.compliant}</span>
            <span className="text-sm text-white/80">Compliant</span>
          </div>
        </div>

        {/* Not Applicable Card */}
        <div
          onClick={() => { setStatusFilter("Not Applicable"); setCurrentPage(0); }}
          className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] p-6 text-white cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${statusFilter === "Not Applicable" ? "ring-2 ring-white/50" : ""}`}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
          <div className="relative flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center mb-4">
              <XCircle className="w-7 h-7 text-white/80" />
            </div>
            <span className="text-4xl font-bold mb-1">{controlStats.notApplicable}</span>
            <span className="text-sm text-white/80">Not Applicable</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search By Control Code , Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 max-w-lg"
          />
        </div>
        <Select value={domainFilter} onValueChange={(v) => { setDomainFilter(v); setCurrentPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Domain</SelectItem>
            {domains.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setCurrentPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Department</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); setCurrentPage(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Assignee</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={functionalGroupingFilter} onValueChange={(v) => { setFunctionalGroupingFilter(v); setCurrentPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Functional Grouping" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Functional Grouping</SelectItem>
            {FUNCTIONAL_GROUPINGS.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#1e1b4b] hover:bg-[#1e1b4b]">
              {visibleColumns.controlCode && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("controlCode")}
                    className="h-8 px-2 font-semibold text-white hover:text-white hover:bg-white/10"
                  >
                    Control Code
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.controlName && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("name")}
                    className="h-8 px-2 font-semibold text-white hover:text-white hover:bg-white/10"
                  >
                    Control Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.functionalGrouping && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("functionalGrouping")}
                    className="h-8 px-2 font-semibold text-white hover:text-white hover:bg-white/10"
                  >
                    FunctionalGroupi...
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                    className="h-8 px-2 font-semibold text-white hover:text-white hover:bg-white/10"
                  >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              {visibleColumns.owner && (
                <TableHead className="font-semibold text-white">Owner</TableHead>
              )}
              {visibleColumns.domain && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("domain")}
                    className="h-8 px-2 font-semibold text-white hover:text-white hover:bg-white/10"
                  >
                    Domain Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              )}
              <TableHead className="w-[50px]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white hover:bg-white/10">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.controlName}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, controlName: checked })}
                    >
                      Control Name
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.controlCode}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, controlCode: checked })}
                    >
                      Control Code
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.functionalGrouping}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, functionalGrouping: checked })}
                    >
                      FunctionalGrouping
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.status}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, status: checked })}
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.owner}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, owner: checked })}
                    >
                      Owner
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.domain}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, domain: checked })}
                    >
                      Domain Name
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedControls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No controls found.
                </TableCell>
              </TableRow>
            ) : (
              sortedControls.map((control) => (
                <TableRow
                  key={control.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onDoubleClick={() => router.push(`/compliance/control/${control.id}`)}
                >
                  {visibleColumns.controlCode && (
                    <TableCell>{control.controlCode}</TableCell>
                  )}
                  {visibleColumns.controlName && (
                    <TableCell className="font-medium">{control.name}</TableCell>
                  )}
                  {visibleColumns.functionalGrouping && (
                    <TableCell>{control.functionalGrouping || "-"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell>{control.status}</TableCell>
                  )}
                  {visibleColumns.owner && (
                    <TableCell>{control.owner?.fullName || "-"}</TableCell>
                  )}
                  {visibleColumns.domain && (
                    <TableCell>{control.domain?.name || "-"}</TableCell>
                  )}
                  <TableCell></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 p-4 border-t">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3 py-1">
            {total > 0
              ? `Currently showing ${startIndex + 1} to ${endIndex} of ${total}`
              : "No controls"}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      </>
      )}

      {/* Create Control Dialog - 3 Step Wizard */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Control - Step {createStep} of 3</DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === createStep
                    ? "bg-primary text-primary-foreground"
                    : step < createStep
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="py-4">
            {/* Step 1: Control Information */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label>Control domain</Label>
                  <Select value={newControl.domainId} onValueChange={(v) => setNewControl({ ...newControl, domainId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Control name</Label>
                  <Input
                    value={newControl.name}
                    onChange={(e) => setNewControl({ ...newControl, name: e.target.value })}
                    placeholder=""
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={newControl.description}
                    onChange={(e) => setNewControl({ ...newControl, description: e.target.value })}
                    placeholder=""
                  />
                </div>
                <div>
                  <Label>Control question</Label>
                  <Input
                    value={newControl.controlQuestion}
                    onChange={(e) => setNewControl({ ...newControl, controlQuestion: e.target.value })}
                    placeholder=""
                  />
                </div>
                <div>
                  <Label>Function Grouping</Label>
                  <Select value={newControl.functionalGrouping} onValueChange={(v) => setNewControl({ ...newControl, functionalGrouping: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNCTIONAL_GROUPINGS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Assignments & Details */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div>
                  <Label>Department</Label>
                  <Select value={newControl.departmentId} onValueChange={(v) => setNewControl({ ...newControl, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {getCustomerScopedDepartments().map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Owner</Label>
                  <Select value={newControl.ownerId} onValueChange={(v) => setNewControl({ ...newControl, ownerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {getCustomerScopedUsers().map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assignee</Label>
                  <Select
                    value={newControl.assigneeId}
                    onValueChange={(v) => setNewControl({ ...newControl, assigneeId: v })}
                    disabled={!newControl.departmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !newControl.departmentId
                          ? "Select department first"
                          : "Select assignee"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredUsersForAssignee().length > 0 ? (
                        getFilteredUsersForAssignee().map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                          No department reviewers found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {createStep === 3 && (
              <div className="space-y-4">
                <h4 className="font-semibold">Review informations</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Domain:</span>
                    <p className="font-medium">{domains.find(d => d.id === newControl.domainId)?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Control Name:</span>
                    <p className="font-medium">{newControl.name || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Description:</span>
                    <p className="font-medium">{newControl.description || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Control Question:</span>
                    <p className="font-medium">{newControl.controlQuestion || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Function Grouping:</span>
                    <p className="font-medium">{newControl.functionalGrouping || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-medium">{getCustomerScopedDepartments().find(d => d.id === newControl.departmentId)?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Owner:</span>
                    <p className="font-medium">{getCustomerScopedUsers().find(u => u.id === newControl.ownerId)?.fullName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assignee:</span>
                    <p className="font-medium">{getCustomerScopedUsers().find(u => u.id === newControl.assigneeId)?.fullName || "-"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else setIsCreateDialogOpen(false);
            }}>
              {createStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button onClick={() => {
              if (createStep < 3) setCreateStep(createStep + 1);
              else handleCreateControl();
            }}>
              {createStep === 3 ? "Create" : "Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
        setIsImportDialogOpen(open);
        if (!open) {
          setImportFile(null);
          if (importFileInputRef.current) {
            importFileInputRef.current.value = "";
          }
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Controls</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file to import controls. You can download a template to see the required format.
            </p>

            <div>
              <Label>File *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={importFile?.name || ""}
                  placeholder="Choose a file..."
                  className="flex-1 bg-muted/50"
                />
                <Button
                  variant="outline"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  Browse...
                </Button>
                <input
                  ref={importFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFileSelect}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: CSV, XLSX, XLS
              </p>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setIsImportDialogOpen(false);
                setImportFile(null);
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleImportSubmit}
                disabled={!importFile || importing}
              >
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all controls? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ControlListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>}>
      <ControlListPageContent />
    </Suspense>
  );
}
