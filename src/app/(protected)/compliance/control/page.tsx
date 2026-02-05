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
  ChevronsLeft,
  ChevronsRight,
  Upload,
  Trash2,
  ArrowUpDown,
  Settings2,
  Download,
  ArrowLeft,
  Home,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
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

const ITEMS_PER_PAGE = 20;

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

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Delete all confirmation
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
          "Govern": "#3b82f6",
          "Identify": "#f97316",
          "Protect": "#22c55e",
          "Detect": "#ef4444",
          "Respond": "#a855f7",
          "Recover": "#78350f",
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
  }, [currentPage, integratedFrameworkFilter, search, selectedStatus]);

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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Controls")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">{t("Controls")}</h1>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">{statusCounts.total}</div>
          <div className="text-sm font-medium text-slate-500">{t("Total Controls")}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">{statusCounts.nonCompliant}</div>
          <div className="text-sm font-medium text-slate-500">{t("Non Compliant")}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">{statusCounts.compliant}</div>
          <div className="text-sm font-medium text-slate-500">{t("Compliant")}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-800 mb-1">{statusCounts.notApplicable}</div>
          <div className="text-sm font-medium text-slate-500">{t("Not Applicable")}</div>
        </div>
      </div>

          {/* Charts Section */}
          <div className="grid grid-cols-2 gap-6">
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

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t("Search by control code or name...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-[300px] bg-white"
              />
              <Select value={integratedFrameworkFilter} onValueChange={setIntegratedFrameworkFilter}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder={t("Integrated Framework")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                  <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                  {frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus || "all"} onValueChange={(v) => { setSelectedStatus(v === "all" ? null : v); setCurrentPage(0); }}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder={t("Status")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="bg-white">
                  <SelectItem value="all">{t("All Status")}</SelectItem>
                  <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                  <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
                  <SelectItem value="Not Applicable">{t("Not Applicable")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <PermissionGate resource="compliance.controls" action="delete">
                <Button
                  size="sm"
                  onClick={() => setIsDeleteAllDialogOpen(true)}
                  variant="outline"
                  className="text-semantic-error hover:text-semantic-error hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("Delete All")}
                </Button>
              </PermissionGate>
              <PermissionGate resource="compliance.controls" action="create">
                <Button size="sm" onClick={handleImport} variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  {t("Import")}
                </Button>
              </PermissionGate>
              {/* Show New Control button for Customer Admin or users with create permission */}
              {isCustomerAdmin ? (
                <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("New Control")}
                </Button>
              ) : (
                <PermissionGate resource="compliance.controls" action="create">
                  <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("New Control")}
                  </Button>
                </PermissionGate>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              {visibleColumns.controlName && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 pl-4 cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    {t("Control Name")}
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.controlCode && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("controlCode")}
                >
                  <div className="flex items-center gap-2">
                    {t("Control Code")}
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.functionalGrouping && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("functionalGrouping")}
                >
                  <div className="flex items-center gap-2">
                    {t("Functional Grouping")}
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.status && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    {t("Status")}
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.assignee && (
                <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Assignee")}</TableHead>
              )}
              {visibleColumns.domain && (
                <TableHead
                  className="text-xs font-semibold text-slate-600 py-4 cursor-pointer select-none"
                  onClick={() => handleSort("domain")}
                >
                  <div className="flex items-center gap-2">
                    {t("Domain Name")}
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              <TableHead className="w-[50px] py-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white w-48">
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.controlName}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, controlName: checked })}
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm"
                    >
                      {t("Control Name")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.controlCode}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, controlCode: checked })}
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm"
                    >
                      {t("Control Code")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.functionalGrouping}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, functionalGrouping: checked })}
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm"
                    >
                      {t("Functional Grouping")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.status}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, status: checked })}
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm"
                    >
                      {t("Status")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.assignee}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, assignee: checked })}
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm"
                    >
                      {t("Assignee")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns.domain}
                      onCheckedChange={(checked) => setVisibleColumns({ ...visibleColumns, domain: checked })}
                      onSelect={(e) => e.preventDefault()}
                      className="text-sm"
                    >
                      {t("Domain Name")}
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <div className="relative h-6 w-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedControls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                  {t("No controls found.")}
                </TableCell>
              </TableRow>
            ) : (
              sortedControls.map((control) => (
                <TableRow
                  key={control.id}
                  className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                  onDoubleClick={() => router.push(`/compliance/control/${control.id}`)}
                >
                  {visibleColumns.controlName && (
                    <TableCell className="py-4 pl-4 text-sm font-medium text-slate-900">{control.name}</TableCell>
                  )}
                  {visibleColumns.controlCode && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.controlCode}</TableCell>
                  )}
                  {visibleColumns.functionalGrouping && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.functionalGrouping || "-"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.status}</TableCell>
                  )}
                  {visibleColumns.assignee && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.assignee?.fullName || "-"}</TableCell>
                  )}
                  {visibleColumns.domain && (
                    <TableCell className="py-4 text-sm text-slate-700">{control.domain?.name || "-"}</TableCell>
                  )}
                  <TableCell className="py-4"></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-sm text-slate-500">
            {total > 0
              ? `${startIndex + 1} ${t("to")} ${endIndex} ${t("of")} ${total}`
              : t("No controls")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(0)}
              disabled={currentPage === 0}
              className="h-8 w-8"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="h-8 w-8"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
            </div>
          </div>
          </div>

          

      {/* Create Control Dialog - 3 Step Wizard */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Control")} - {t("Step")} {createStep} {t("of")} 3</DialogTitle>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 pb-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === createStep
                      ? "bg-primary text-primary-foreground"
                      : step < createStep
                      ? "bg-green-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-slate-100"}`} />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {/* Step 1: Control Information */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Control Domain")}</Label>
                      <Select value={newControl.domainId} onValueChange={(v) => setNewControl({ ...newControl, domainId: v })}>
                        <SelectTrigger className="mt-1.5 bg-white w-full">
                          <SelectValue placeholder={t("Select domain")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {domains.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Functional Grouping")}</Label>
                      <Select value={newControl.functionalGrouping} onValueChange={(v) => setNewControl({ ...newControl, functionalGrouping: v })}>
                        <SelectTrigger className="mt-1.5 bg-white w-full">
                          <SelectValue placeholder={t("Select grouping")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {FUNCTIONAL_GROUPINGS.map((g) => (
                            <SelectItem key={g} value={g}>{t(g)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Control Name")}</Label>
                    <Input
                      value={newControl.name}
                      onChange={(e) => setNewControl({ ...newControl, name: e.target.value })}
                      placeholder={t("Enter control name")}
                      className="mt-1.5 bg-white"
                    />
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
                    <Label className="text-sm font-medium text-slate-700">{t("Control Question")}</Label>
                    <Input
                      value={newControl.controlQuestion}
                      onChange={(e) => setNewControl({ ...newControl, controlQuestion: e.target.value })}
                      placeholder={t("Enter control question")}
                      className="mt-1.5 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Assignments & Details */}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                      <Select value={newControl.departmentId} onValueChange={(v) => setNewControl({ ...newControl, departmentId: v, assigneeId: "" })}>
                        <SelectTrigger className="mt-1.5 bg-white w-full">
                          <SelectValue placeholder={t("Select department")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {getCustomerScopedDepartments().map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Owner")}</Label>
                      <Select value={newControl.ownerId} onValueChange={(v) => setNewControl({ ...newControl, ownerId: v })}>
                        <SelectTrigger className="mt-1.5 bg-white w-full">
                          <SelectValue placeholder={t("Select owner")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {getCustomerScopedUsers().map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Assignee")}</Label>
                    <Select
                      value={newControl.assigneeId}
                      onValueChange={(v) => setNewControl({ ...newControl, assigneeId: v })}
                      disabled={!newControl.departmentId}
                    >
                      <SelectTrigger className="mt-1.5 bg-white w-full">
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
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("Review Information")}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">{t("Domain")}:</span>
                      <p className="font-medium">{domains.find(d => d.id === newControl.domainId)?.name || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Control Name")}:</span>
                      <p className="font-medium">{newControl.name || "-"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">{t("Description")}:</span>
                      <p className="font-medium">{newControl.description || "-"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">{t("Control Question")}:</span>
                      <p className="font-medium">{newControl.controlQuestion || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Functional Grouping")}:</span>
                      <p className="font-medium">{newControl.functionalGrouping ? t(newControl.functionalGrouping) : "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Department")}:</span>
                      <p className="font-medium">{getCustomerScopedDepartments().find(d => d.id === newControl.departmentId)?.name || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Owner")}:</span>
                      <p className="font-medium">{getCustomerScopedUsers().find(u => u.id === newControl.ownerId)?.fullName || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Assignee")}:</span>
                      <p className="font-medium">{getCustomerScopedUsers().find(u => u.id === newControl.assigneeId)?.fullName || "-"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else setIsCreateDialogOpen(false);
            }}>
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button onClick={() => {
              if (createStep < 3) setCreateStep(createStep + 1);
              else handleCreateControl();
            }}>
              {createStep === 3 ? t("Create") : t("Next")}
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Controls")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
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
          <AlertDialogFooter>
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
