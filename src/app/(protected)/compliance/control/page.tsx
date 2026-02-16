"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
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
  Upload,
  Trash2,
  ArrowUpDown,
  Settings2,
  Download,
  Home,
  Search,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

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

const ITEMS_PER_PAGE = 10;

function ControlListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const { data: session } = useSession();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.controls');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const [controls, setControls] = useState<Control[]>([]);
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
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    controlName: true,
    controlCode: true,
    functionalGrouping: true,
    status: true,
    assignee: true,
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
  const [controlErrors, setControlErrors] = useState<Record<string, string>>({});

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Delete all confirmation
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Create domain dialog
  const [isCreateDomainDialogOpen, setIsCreateDomainDialogOpen] = useState(false);
  const [newDomain, setNewDomain] = useState({ code: "", name: "" });
  const [creatingDomain, setCreatingDomain] = useState(false);
  const [domainErrors, setDomainErrors] = useState<Record<string, string>>({});

  // Status counts for cards
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    nonCompliant: 0,
    compliant: 0,
    notApplicable: 0,
  });

  // Selected status filter for tile cards
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  // Dashboard data
  const [allControlsForDashboard, setAllControlsForDashboard] = useState<Control[]>([]);
  const [functionalGroupingData, setFunctionalGroupingData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [frameworkChartData, setFrameworkChartData] = useState<{ name: string; compliant: number; nonCompliant: number; notApplicable: number }[]>([]);

  useEffect(() => {
    fetchFilterOptions();
    fetchStatusCounts();
  }, [session?.user?.id]);

  useEffect(() => {
    fetchStatusCounts();
  }, []);

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

  const fetchStatusCounts = async () => {
    try {
      // Fetch all controls to get status counts (without pagination)
      const response = await fetch("/api/controls?limit=10000");
      if (response.ok) {
        const data = await response.json();
        const allControls = data.data || [];
        setAllControlsForDashboard(allControls);

        const counts = {
          total: allControls.length,
          nonCompliant: allControls.filter((c: Control) => c.status === "Non Compliant").length,
          compliant: allControls.filter((c: Control) => c.status === "Compliant").length,
          notApplicable: allControls.filter((c: Control) => c.status === "Not Applicable").length,
        };
        setStatusCounts(counts);

        // Calculate Functional Grouping data for donut chart
        const groupingColors: Record<string, string> = {
          "Govern": "#4F46E5",
          "Identify": "#F59E0B",
          "Protect": "#10B981",
          "Detect": "#EF4444",
          "Respond": "#8B5CF6",
          "Recover": "#78716C",
        };
        const groupingCounts: Record<string, number> = {};
        allControls.forEach((c: Control) => {
          const group = c.functionalGrouping || "Unknown";
          groupingCounts[group] = (groupingCounts[group] || 0) + 1;
        });
        const fgData = Object.entries(groupingCounts)
          .filter(([name]) => FUNCTIONAL_GROUPINGS.includes(name))
          .map(([name, value]) => ({
            name,
            value,
            color: groupingColors[name] || "#64748b",
          }));
        setFunctionalGroupingData(fgData);

        // Calculate By Framework data for bar chart
        const frameworkStats: Record<string, { compliant: number; nonCompliant: number; notApplicable: number }> = {};
        allControls.forEach((c: Control) => {
          const fwName = c.framework?.name || "No Framework";
          if (!frameworkStats[fwName]) {
            frameworkStats[fwName] = { compliant: 0, nonCompliant: 0, notApplicable: 0 };
          }
          if (c.status === "Compliant") frameworkStats[fwName].compliant++;
          else if (c.status === "Non Compliant") frameworkStats[fwName].nonCompliant++;
          else if (c.status === "Not Applicable") frameworkStats[fwName].notApplicable++;
        });
        const fwData = Object.entries(frameworkStats).map(([name, stats]) => ({
          name: name.length > 8 ? name.substring(0, 8) + ".." : name,
          fullName: name,
          compliant: stats.compliant,
          nonCompliant: stats.nonCompliant,
          notApplicable: stats.notApplicable,
        }));
        setFrameworkChartData(fwData);
      }
    } catch (error) {
      console.error("Error fetching status counts:", error);
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
      if (departmentFilter && departmentFilter !== "all") {
        params.set("departmentId", departmentFilter);
      }
      if (assigneeFilter && assigneeFilter !== "all") {
        params.set("assigneeId", assigneeFilter);
      }
      if (search) params.set("search", search);
      if (selectedStatus) params.set("status", selectedStatus);

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
  }, [currentPage, integratedFrameworkFilter, departmentFilter, assigneeFilter, search, selectedStatus]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

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
        toast({ title: t("Success"), description: `${t("Successfully imported")} ${result.imported} ${t("control(s)")}` });
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchControls();
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: `${t("Import failed")}: ${error.message || t("Unknown error")}`, variant: "destructive" });
      }
    } catch (error) {
      console.error("Error importing controls:", error);
      toast({ title: t("Error"), description: t("Failed to import controls"), variant: "destructive" });
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
        toast({ title: t("Error"), description: t("Failed to delete controls"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting controls:", error);
      toast({ title: t("Error"), description: t("Failed to delete controls"), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Control Code", "Name", "Description", "Control Question", "Functional Grouping", "Status", "Domain", "Framework", "Department", "Owner", "Assignee"],
      ...controls.map((c) => [
        c.controlCode,
        c.name,
        c.description || "",
        c.controlQuestion || "",
        c.functionalGrouping || "",
        c.status,
        c.domain?.name || "",
        c.framework?.name || "",
        c.department?.name || "",
        c.owner?.fullName || "",
        c.assignee?.fullName || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controls.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleCreateControl = async () => {
    try {
      const response = await fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newControl),
      });
      if (response.ok) {
        toast({ title: t("Success"), description: t("Control created successfully") });
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
          title: t("Error"),
          description: errorData.error || t("Failed to create control"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating control:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create control"),
        variant: "destructive"
      });
    }
  };

  const handleCreateDomain = async () => {
    const errors: Record<string, string> = {};
    if (!newDomain.code.trim()) errors.code = t("Please enter Domain Code");
    if (!newDomain.name.trim()) errors.name = t("Please enter Domain name");
    if (Object.keys(errors).length > 0) { setDomainErrors(errors); return; }
    setDomainErrors({});
    setCreatingDomain(true);
    try {
      const response = await fetch("/api/control-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDomain),
      });

      if (response.ok) {
        const createdDomain = await response.json();
        toast({
          title: t("Success"),
          description: t("Domain created successfully"),
        });
        setIsCreateDomainDialogOpen(false);
        setNewDomain({ code: "", name: "" });
        setDomainErrors({});
        // Refresh domains list and select the newly created domain
        const domainRes = await fetch("/api/control-domains");
        if (domainRes.ok) {
          setDomains(await domainRes.json());
        }
        // Auto-select the newly created domain
        setNewControl({ ...newControl, domainId: createdDomain.id });
      } else {
        const errorData = await response.json();
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to create domain"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error creating domain:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create domain"),
        variant: "destructive"
      });
    } finally {
      setCreatingDomain(false);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Compliant":
        return "bg-success-light text-success-dark border-green-200";
      case "Partial Compliant":
        return "bg-warning-light text-warning-dark border-amber-200";
      case "Non Compliant":
        return "bg-error-light text-error-dark border-red-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Controls.")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <div className="flex items-center gap-1.5 text-slate-500 ">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Controls")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Controls")}</h1>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{statusCounts.total}</div>
          <div className="mt-1 text-sm font-medium text-slate-500">{t("Total Controls")}</div>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{statusCounts.nonCompliant}</div>
          <div className="mt-1 text-sm font-medium text-slate-500">{t("Non Compliant")}</div>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{statusCounts.compliant}</div>
          <div className="mt-1 text-sm font-medium text-slate-500">{t("Compliant")}</div>
        </div>
        <div className="bg-white rounded-xl p-3 sm:p-5 border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-slate-800">{statusCounts.notApplicable}</div>
          <div className="mt-1 text-sm font-medium text-slate-500">{t("Not Applicable")}</div>
        </div>
      </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Functional Grouping Donut Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-medium text-slate-500 mb-4">{t("Functional Grouping")}</h3>
              <div className="h-[300px]">
                {functionalGroupingData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={functionalGroupingData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={false}
                      >
                        {functionalGroupingData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
                                <p className="text-sm font-medium text-slate-800">{data.name}: {data.value}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="bottom"
                        iconType="square"
                        iconSize={12}
                        formatter={(value) => <span className="text-sm text-slate-600">{t(value)}</span>}
                      />
                      {/* Center text */}
                      <text x="50%" y="45%" textAnchor="middle" className="fill-slate-500 text-sm">
                        {t("Total")}
                      </text>
                      <text x="50%" y="55%" textAnchor="middle" className="fill-slate-800 text-2xl font-bold">
                        {statusCounts.total}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    {t("No data available")}
                  </div>
                )}
              </div>
            </div>

            {/* By Framework Bar Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-medium text-slate-500 mb-4">{t("Controls by Framework")}</h3>
              <div className="h-[300px]">
                {frameworkChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={frameworkChartData}
                      margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                      barCategoryGap="20%"
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const total = data.compliant + data.nonCompliant + data.notApplicable;
                            return (
                              <div className="bg-white px-4 py-3 rounded-xl shadow-lg border border-slate-100">
                                <p className="text-sm font-semibold text-slate-800 mb-2">{data.fullName || data.name}</p>
                                <div className="space-y-1.5">
                                  <p className="text-xs flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-slate-600">{t("Compliant")}:</span>
                                    <span className="font-semibold text-slate-800">{data.compliant}</span>
                                    <span className="text-slate-400">({total > 0 ? Math.round((data.compliant / total) * 100) : 0}%)</span>
                                  </p>
                                  <p className="text-xs flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    <span className="text-slate-600">{t("Non Compliant")}:</span>
                                    <span className="font-semibold text-slate-800">{data.nonCompliant}</span>
                                    <span className="text-slate-400">({total > 0 ? Math.round((data.nonCompliant / total) * 100) : 0}%)</span>
                                  </p>
                                  <p className="text-xs flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                    <span className="text-slate-600">{t("Not Applicable")}:</span>
                                    <span className="font-semibold text-slate-800">{data.notApplicable}</span>
                                    <span className="text-slate-400">({total > 0 ? Math.round((data.notApplicable / total) * 100) : 0}%)</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        layout="horizontal"
                        align="center"
                        verticalAlign="top"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ paddingBottom: '10px' }}
                        formatter={(value) => <span className="text-xs text-slate-600">{t(value)}</span>}
                      />
                      <Bar dataKey="compliant" name="Compliant" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="nonCompliant" name="Non Compliant" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="notApplicable" name="Not Applicable" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">
                    {t("No data available")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Export")}
            </Button>
            <PermissionGate resource="compliance.controls" action="create">
              <Button size="sm" onClick={handleImport} variant="outline">
                <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </Button>
            </PermissionGate>
            {isCustomerAdmin ? (
              <Button size="sm" onClick={() => { setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" }); setControlErrors({}); setCreateStep(1); setIsCreateDialogOpen(true); }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("New Control")}
              </Button>
            ) : (
              <PermissionGate resource="compliance.controls" action="create">
                <Button size="sm" onClick={() => { setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" }); setControlErrors({}); setCreateStep(1); setIsCreateDialogOpen(true); }}>
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("New Control")}
                </Button>
              </PermissionGate>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("Search by control code or name...")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full sm:w-64 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                />
              </div>
              <div className="ltr:ml-auto rtl:mr-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Select value={integratedFrameworkFilter} onValueChange={setIntegratedFrameworkFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Integrated Framework")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                    {frameworks.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Departments")}</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                    <SelectValue placeholder={t("Assignee")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    <SelectItem value="all">{t("All Assignees")}</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              {visibleColumns.controlName && (
                <TableHead
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 ps-5 cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  {t("Control Name")}
                </TableHead>
              )}
              {visibleColumns.controlCode && (
                <TableHead
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 cursor-pointer select-none"
                  onClick={() => handleSort("controlCode")}
                >
                  {t("Control Code")}
                </TableHead>
              )}
              {visibleColumns.functionalGrouping && (
                <TableHead
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 cursor-pointer select-none"
                  onClick={() => handleSort("functionalGrouping")}
                >
                  {t("Functional Grouping")}
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 cursor-pointer select-none"
                  onClick={() => handleSort("status")}
                >
                  {t("Status")}
                </TableHead>
              )}
              {visibleColumns.assignee && (
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3">{t("Assignee")}</TableHead>
              )}
              {visibleColumns.domain && (
                <TableHead
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider h-auto py-3 cursor-pointer select-none"
                  onClick={() => handleSort("domain")}
                >
                  {t("Domain Name")}
                </TableHead>
              )}
              <TableHead className="h-auto py-3 pe-5 text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedControls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-primary-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">
                    {search || integratedFrameworkFilter !== "all" || departmentFilter !== "all" || assigneeFilter !== "all"
                      ? t("No controls match your filters")
                      : t("No controls found")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {search || integratedFrameworkFilter !== "all" || departmentFilter !== "all" || assigneeFilter !== "all"
                      ? t("Try adjusting your search or filters")
                      : t("Create a new control to get started")}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedControls.map((control) => (
                <TableRow
                  key={control.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                >
                  {visibleColumns.controlName && (
                    <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{control.name}</TableCell>
                  )}
                  {visibleColumns.controlCode && (
                    <TableCell className="py-3.5 text-sm text-slate-600">{control.controlCode}</TableCell>
                  )}
                  {visibleColumns.functionalGrouping && (
                    <TableCell className="py-3.5 text-sm text-slate-600">{control.functionalGrouping || "-"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell className="py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(control.status)}`}>
                        {t(control.status || "Not Set")}
                      </span>
                    </TableCell>
                  )}
                  {visibleColumns.assignee && (
                    <TableCell className="py-3.5 text-sm text-slate-600">{control.assignee?.fullName || "-"}</TableCell>
                  )}
                  {visibleColumns.domain && (
                    <TableCell className="py-3.5 text-sm text-slate-600">{control.domain?.name || "-"}</TableCell>
                  )}
                  <TableCell className="py-3.5 pe-5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        onClick={() => router.push(`/compliance/control/${control.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {total > 0
              ? t("Showing {start} to {end} of {total}").replace("{start}", String(startIndex + 1)).replace("{end}", String(endIndex)).replace("{total}", String(total))
              : t("No controls")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-7 w-7 text-slate-400 hover:text-slate-600"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
          </div>

          

      {/* Create Control Dialog - 3 Step Wizard */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) { setIsCreateDialogOpen(false); setCreateStep(1); setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" }); setControlErrors({}); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Control")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Step Progress */}
          <div className="flex-shrink-0 flex items-start justify-center py-4 sm:py-5 px-4 sm:px-6 border-b border-slate-100">
            {[
              { id: 1, name: t("Information") },
              { id: 2, name: t("Assignment") },
              { id: 3, name: t("Review") },
            ].map((step, index) => (
              <div key={step.id} className="flex items-start">
                <div className="flex flex-col items-center w-24">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      createStep > step.id
                        ? "bg-success text-white"
                        : createStep === step.id
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                    }`}
                  >
                    {createStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center ${
                      createStep >= step.id ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < 2 && (
                  <div
                    className={`w-8 h-0.5 mt-[18px] -mx-3 transition-colors ${
                      createStep > step.id ? "bg-success" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="space-y-5">
              {/* Step 1: Control Information */}
              {createStep === 1 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Control Information")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Control Domain")} <span className="text-error">*</span></Label>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Select value={newControl.domainId} onValueChange={(v) => { setNewControl({ ...newControl, domainId: v }); if (controlErrors.domainId) setControlErrors((prev) => { const { domainId, ...rest } = prev; return rest; }); }}>
                          <SelectTrigger className={`bg-white flex-1 ${controlErrors.domainId ? "border-red-500 focus:ring-red-500" : ""}`}>
                            <SelectValue placeholder={t("Select domain")} />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                            {domains.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => setIsCreateDomainDialogOpen(true)}
                          className="h-10 w-10 shrink-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {controlErrors.domainId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.domainId}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Functional Grouping")} <span className="text-error">*</span></Label>
                      <Select value={newControl.functionalGrouping} onValueChange={(v) => { setNewControl({ ...newControl, functionalGrouping: v }); if (controlErrors.functionalGrouping) setControlErrors((prev) => { const { functionalGrouping, ...rest } = prev; return rest; }); }}>
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.functionalGrouping ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select grouping")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {FUNCTIONAL_GROUPINGS.map((g) => (
                            <SelectItem key={g} value={g}>{t(g)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {controlErrors.functionalGrouping && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.functionalGrouping}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Control Name")} <span className="text-error">*</span></Label>
                    <Input
                      value={newControl.name}
                      onChange={(e) => { setNewControl({ ...newControl, name: e.target.value }); if (controlErrors.name) setControlErrors((prev) => { const { name, ...rest } = prev; return rest; }); }}
                      placeholder={t("Enter control name")}
                      className={`mt-1.5 bg-white ${controlErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {controlErrors.name && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{controlErrors.name}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <Input
                      value={newControl.description}
                      onChange={(e) => setNewControl({ ...newControl, description: e.target.value })}
                      placeholder={t("Enter description")}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Control Question")} <span className="text-error">*</span></Label>
                    <Input
                      value={newControl.controlQuestion}
                      onChange={(e) => { setNewControl({ ...newControl, controlQuestion: e.target.value }); if (controlErrors.controlQuestion) setControlErrors((prev) => { const { controlQuestion, ...rest } = prev; return rest; }); }}
                      placeholder={t("Enter control question")}
                      className={`mt-1.5 bg-white ${controlErrors.controlQuestion ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {controlErrors.controlQuestion && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{controlErrors.controlQuestion}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Assignments & Details */}
              {createStep === 2 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Assignment Details")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Department")} <span className="text-error">*</span></Label>
                      <Select value={newControl.departmentId} onValueChange={(v) => { setNewControl({ ...newControl, departmentId: v, assigneeId: "" }); if (controlErrors.departmentId) setControlErrors((prev) => { const { departmentId, ...rest } = prev; return rest; }); }}>
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select department")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {getCustomerScopedDepartments().map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {controlErrors.departmentId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.departmentId}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Assignee")} <span className="text-error">*</span></Label>
                      <Select
                        value={newControl.assigneeId}
                        onValueChange={(v) => { setNewControl({ ...newControl, assigneeId: v }); if (controlErrors.assigneeId) setControlErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; }); }}
                        disabled={!newControl.departmentId}
                      >
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={
                            !newControl.departmentId
                              ? t("Select department first")
                              : t("Select assignee")
                          } />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {getFilteredUsersForAssignee().length > 0 ? (
                            getFilteredUsersForAssignee().map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-2 text-sm text-slate-400 text-center">
                              {t("No department reviewers found")}
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      {controlErrors.assigneeId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.assigneeId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {createStep === 3 && (
                <div className="space-y-5">
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">{t("Review Information")}</h3>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Domain")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{domains.find(d => d.id === newControl.domainId)?.name || "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 ltr:border-l rtl:border-r border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Control Name")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.name || "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 col-span-2">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Description")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.description || "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 col-span-2">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Control Question")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.controlQuestion || "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Functional Grouping")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{newControl.functionalGrouping ? t(newControl.functionalGrouping) : "-"}</p>
                      </div>
                      <div className="px-4 py-3 border-b border-slate-100 ltr:border-l rtl:border-r border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Department")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{getCustomerScopedDepartments().find(d => d.id === newControl.departmentId)?.name || "-"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{t("Assignee")}</span>
                        <p className="text-sm font-medium text-slate-800 mt-0.5">{getCustomerScopedUsers().find(u => u.id === newControl.assigneeId)?.fullName || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <span className="text-xs font-medium text-slate-400 me-auto">
              {t("Step")} {createStep} {t("of")} 3
            </span>
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                setIsCreateDialogOpen(false);
                setCreateStep(1);
                setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" });
                setControlErrors({});
              }
            }}>
              {createStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button onClick={() => {
              if (createStep === 1) {
                const errors: Record<string, string> = {};
                if (!newControl.domainId) errors.domainId = t("Please select the Control Domain");
                if (!newControl.name.trim()) errors.name = t("Please enter name");
                if (!newControl.controlQuestion?.trim()) errors.controlQuestion = t("Please enter the question");
                if (!newControl.functionalGrouping) errors.functionalGrouping = t("Please select the Functional Grouping");
                if (Object.keys(errors).length > 0) { setControlErrors(errors); return; }
                setControlErrors({});
              }
              if (createStep === 2) {
                const errors: Record<string, string> = {};
                if (!newControl.departmentId) errors.departmentId = t("Please select the Department");
                if (!newControl.assigneeId) errors.assigneeId = t("Please select the assignee");
                if (Object.keys(errors).length > 0) { setControlErrors(errors); return; }
                setControlErrors({});
              }
              if (createStep < 3) setCreateStep(createStep + 1);
              else handleCreateControl();
            }}>
              {createStep === 3 ? t("Create") : t("Next")}
              {createStep < 3 && <ChevronRight className="h-4 w-4 ms-1" />}
            </Button>
          </div>
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Controls")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            <p className="text-sm text-slate-500">
              {t("Upload a CSV file to import controls. You can download a template to see the required format.")}
            </p>

            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")} *</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Input
                  readOnly
                  value={importFile?.name || ""}
                  placeholder={t("Choose a file...")}
                  className="flex-1 bg-white min-w-0"
                />
                <Button
                  variant="outline"
                  onClick={() => importFileInputRef.current?.click()}
                  className="flex-shrink-0"
                >
                  {t("Browse...")}
                </Button>
                <input
                  ref={importFileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportFileSelect}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {t("Supported formats: CSV, XLSX, XLS")}
              </p>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t("Download Template")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setIsImportDialogOpen(false);
                setImportFile(null);
              }}>
                {t("Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleImportSubmit}
                disabled={!importFile || importing}
              >
                {importing ? t("Importing...") : t("Import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete All Controls")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete all controls? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? t("Deleting...") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Domain Dialog */}
      <Dialog open={isCreateDomainDialogOpen} onOpenChange={(open) => { if (!open) { setIsCreateDomainDialogOpen(false); setNewDomain({ code: "", name: "" }); setDomainErrors({}); } else { setIsCreateDomainDialogOpen(true); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Create New Domain")}</DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Domain Code")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newDomain.code}
                onChange={(e) => {
                  setNewDomain({ ...newDomain, code: e.target.value });
                  if (domainErrors.code) setDomainErrors((prev) => { const { code, ...rest } = prev; return rest; });
                }}
                placeholder={t("e.g., GOV")}
                className={`mt-1.5 w-full bg-white ${domainErrors.code ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {domainErrors.code && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{domainErrors.code}</p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t("Domain Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newDomain.name}
                onChange={(e) => {
                  setNewDomain({ ...newDomain, name: e.target.value });
                  if (domainErrors.name) setDomainErrors((prev) => { const { name, ...rest } = prev; return rest; });
                }}
                placeholder={t("e.g., Governance")}
                className={`mt-1.5 w-full bg-white ${domainErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {domainErrors.name && (
                <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-600">{domainErrors.name}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsCreateDomainDialogOpen(false);
              setNewDomain({ code: "", name: "" });
              setDomainErrors({});
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleCreateDomain}>
              {t("Create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ControlListPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    }>
      <ControlListPageContent />
    </Suspense>
  );
}
