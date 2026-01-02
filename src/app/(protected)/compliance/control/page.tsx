"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Menu,
} from "lucide-react";

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
  _count?: { evidences: number; exceptions: number; requirements: number };
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

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
}

const FUNCTIONAL_GROUPINGS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];
const STATUS_OPTIONS = ["Non Compliant", "Compliant", "Not Applicable", "Partial Compliant"];

// Colors for charts
const FUNCTIONAL_GROUPING_COLORS: Record<string, string> = {
  Govern: "#3B82F6",
  Identify: "#10B981",
  Protect: "#F59E0B",
  Detect: "#EF4444",
  Respond: "#8B5CF6",
  Recover: "#EC4899",
};

export default function ControlListPage() {
  const router = useRouter();
  const [controls, setControls] = useState<Control[]>([]);
  const [allControls, setAllControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "dashboard">("list");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [integratedFrameworkFilter, setIntegratedFrameworkFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [functionalGroupingFilter, setFunctionalGroupingFilter] = useState<string>("all");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    controlName: true,
    controlCode: true,
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

  // Status counts
  const [statusCounts, setStatusCounts] = useState({
    total: 0,
    nonCompliant: 0,
    compliant: 0,
    notApplicable: 0,
  });

  // Dashboard stats
  const [functionalGroupingStats, setFunctionalGroupingStats] = useState<Record<string, number>>({});
  const [frameworkStats, setFrameworkStats] = useState<Record<string, number>>({});

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

  useEffect(() => {
    fetchFilterOptions();
    fetchAllControlsForStats();
  }, []);

  useEffect(() => {
    fetchControls();
  }, [currentPage, statusFilter, integratedFrameworkFilter, domainFilter, departmentFilter, assigneeFilter, functionalGroupingFilter]);

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
      if (userRes.ok) setUsers(await userRes.json());
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchAllControlsForStats = async () => {
    try {
      const response = await fetch("/api/controls?limit=10000");
      if (response.ok) {
        const data = await response.json();
        setAllControls(data.data || []);
        calculateDashboardStats(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching all controls:", error);
    }
  };

  const calculateDashboardStats = (controlsData: Control[]) => {
    // Functional grouping stats
    const fgStats: Record<string, number> = {};
    FUNCTIONAL_GROUPINGS.forEach(fg => { fgStats[fg] = 0; });

    // Framework stats
    const fwStats: Record<string, number> = {};

    controlsData.forEach(control => {
      if (control.functionalGrouping) {
        fgStats[control.functionalGrouping] = (fgStats[control.functionalGrouping] || 0) + 1;
      }
      if (control.framework?.name) {
        fwStats[control.framework.name] = (fwStats[control.framework.name] || 0) + 1;
      }
    });

    setFunctionalGroupingStats(fgStats);
    setFrameworkStats(fwStats);
  };

  const fetchControls = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", "20");
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (integratedFrameworkFilter && integratedFrameworkFilter !== "all") params.set("frameworkId", integratedFrameworkFilter);
      if (domainFilter && domainFilter !== "all") params.set("domainId", domainFilter);
      if (departmentFilter && departmentFilter !== "all") params.set("departmentId", departmentFilter);
      if (assigneeFilter && assigneeFilter !== "all") params.set("assigneeId", assigneeFilter);
      if (functionalGroupingFilter && functionalGroupingFilter !== "all") params.set("functionalGrouping", functionalGroupingFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/controls?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setControls(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);

        // Update status counts from all controls
        const allRes = await fetch("/api/controls?limit=10000");
        if (allRes.ok) {
          const allData = await allRes.json();
          const counts = { total: allData.pagination.total, nonCompliant: 0, compliant: 0, notApplicable: 0 };
          allData.data.forEach((c: Control) => {
            if (c.status === "Non Compliant") counts.nonCompliant++;
            else if (c.status === "Compliant") counts.compliant++;
            else if (c.status === "Not Applicable") counts.notApplicable++;
          });
          setStatusCounts(counts);
        }
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, integratedFrameworkFilter, domainFilter, departmentFilter, assigneeFilter, functionalGroupingFilter, search]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchControls();
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/controls?limit=10000");
      if (response.ok) {
        const data = await response.json();
        const csvContent = convertToCSV(data.data);
        downloadCSV(csvContent, "controls-export.csv");
      }
    } catch (error) {
      console.error("Error exporting controls:", error);
    }
  };

  const convertToCSV = (data: Control[]) => {
    const headers = ["Control Code", "Control Name", "Description", "Functional Grouping", "Status", "Owner", "Domain", "Framework"];
    const rows = data.map(c => [
      c.controlCode,
      c.name,
      c.description || "",
      c.functionalGrouping || "",
      c.status,
      c.owner?.fullName || "",
      c.domain?.name || "",
      c.framework?.name || "",
    ]);
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

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
        alert(`Successfully imported ${result.imported} control(s)`);
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchControls();
        fetchAllControlsForStats();
      } else {
        const error = await response.json();
        alert(`Import failed: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error importing controls:", error);
      alert("Failed to import controls");
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

  const handleCreateControl = async () => {
    try {
      const response = await fetch("/api/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newControl),
      });
      if (response.ok) {
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
        fetchAllControlsForStats();
      }
    } catch (error) {
      console.error("Error creating control:", error);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Compliant":
        return "bg-green-100 text-green-800";
      case "Non Compliant":
        return "bg-red-100 text-red-800";
      case "Not Applicable":
        return "bg-gray-100 text-gray-800";
      case "Partial Compliant":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get users for assignee dropdown filtered by department
  const getFilteredUsers = () => {
    if (!newControl.departmentId) return users;
    return users.filter((u) => u.departmentId === newControl.departmentId);
  };

  // Calculate total for donut chart
  const totalFunctionalGrouping = Object.values(functionalGroupingStats).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controls</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Control
          </Button>
        </div>
      </div>

      {/* All Controls / Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "list" | "dashboard")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list">All Controls</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          {/* Integrated Framework Filter */}
          <Select value={integratedFrameworkFilter} onValueChange={setIntegratedFrameworkFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Integrated Framework" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              {frameworks.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="list" className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="cursor-pointer hover:shadow-md" onClick={() => setStatusFilter("all")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{statusCounts.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-red-500" onClick={() => setStatusFilter("Non Compliant")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{statusCounts.nonCompliant}</div>
                <div className="text-sm text-muted-foreground">Non Compliant</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-green-500" onClick={() => setStatusFilter("Compliant")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{statusCounts.compliant}</div>
                <div className="text-sm text-muted-foreground">Compliant</div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md border-l-4 border-l-gray-500" onClick={() => setStatusFilter("Not Applicable")}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-600">{statusCounts.notApplicable}</div>
                <div className="text-sm text-muted-foreground">Not Applicable</div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4 items-center mb-4">
                <div className="flex-1 flex gap-2">
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="max-w-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Domains</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Assignees</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={functionalGroupingFilter} onValueChange={setFunctionalGroupingFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Functional Grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groupings</SelectItem>
                    {FUNCTIONAL_GROUPINGS.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Control List</CardTitle>
              {/* Column Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-4 w-4" />
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
                    Functional Grouping
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
                    Domain
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleColumns.controlName && <TableHead>Control Name</TableHead>}
                        {visibleColumns.controlCode && <TableHead>Control Code</TableHead>}
                        {visibleColumns.functionalGrouping && <TableHead>Functional Grouping</TableHead>}
                        {visibleColumns.status && <TableHead>Status</TableHead>}
                        {visibleColumns.owner && <TableHead>Owner</TableHead>}
                        {visibleColumns.domain && <TableHead>Domain</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {controls.map((control) => (
                        <TableRow
                          key={control.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/compliance/control/${control.id}`)}
                        >
                          {visibleColumns.controlName && <TableCell className="font-medium">{control.name}</TableCell>}
                          {visibleColumns.controlCode && <TableCell>{control.controlCode}</TableCell>}
                          {visibleColumns.functionalGrouping && <TableCell>{control.functionalGrouping || "-"}</TableCell>}
                          {visibleColumns.status && (
                            <TableCell>
                              <Badge className={getStatusBadgeColor(control.status)}>
                                {control.status}
                              </Badge>
                            </TableCell>
                          )}
                          {visibleColumns.owner && <TableCell>{control.owner?.fullName || "-"}</TableCell>}
                          {visibleColumns.domain && <TableCell>{control.domain?.name || "-"}</TableCell>}
                        </TableRow>
                      ))}
                      {controls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No controls found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * 20 + 1} to {Math.min(currentPage * 20, total)} of {total} controls
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Dashboard Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Functional Grouping Donut Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Functional Grouping</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  {/* Simple Donut Chart Visualization */}
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {(() => {
                        let currentAngle = 0;
                        return FUNCTIONAL_GROUPINGS.map((fg) => {
                          const count = functionalGroupingStats[fg] || 0;
                          const percentage = totalFunctionalGrouping > 0 ? (count / totalFunctionalGrouping) * 100 : 0;
                          const angle = (percentage / 100) * 360;
                          const startAngle = currentAngle;
                          currentAngle += angle;

                          if (percentage === 0) return null;

                          const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                          const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                          const x2 = 50 + 40 * Math.cos(((startAngle + angle) * Math.PI) / 180);
                          const y2 = 50 + 40 * Math.sin(((startAngle + angle) * Math.PI) / 180);
                          const largeArc = angle > 180 ? 1 : 0;

                          return (
                            <path
                              key={fg}
                              d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                              fill={FUNCTIONAL_GROUPING_COLORS[fg]}
                            />
                          );
                        });
                      })()}
                      <circle cx="50" cy="50" r="25" fill="white" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{totalFunctionalGrouping}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="space-y-2">
                    {FUNCTIONAL_GROUPINGS.map((fg) => (
                      <div key={fg} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: FUNCTIONAL_GROUPING_COLORS[fg] }}
                        />
                        <span className="text-sm">{fg}</span>
                        <span className="text-sm font-medium ml-auto">{functionalGroupingStats[fg] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By Framework Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>By Framework</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(frameworkStats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([framework, count], index) => {
                      const maxCount = Math.max(...Object.values(frameworkStats));
                      const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];
                      return (
                        <div key={framework} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="truncate max-w-[200px]">{framework}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <div className="h-4 bg-gray-100 rounded">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: colors[index % colors.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys(frameworkStats).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No framework data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Control Dialog - 3 Step Wizard (Fixed Step Order) */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              New Control - Step {createStep} of 3
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* Step 1: Domain, Name, Description, Control Question, Functional Grouping */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="domainId">Control Domain *</Label>
                  <Select value={newControl.domainId} onValueChange={(v) => setNewControl({ ...newControl, domainId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="name">Control Name *</Label>
                  <Input
                    id="name"
                    value={newControl.name}
                    onChange={(e) => setNewControl({ ...newControl, name: e.target.value })}
                    placeholder="Enter control name"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newControl.description}
                    onChange={(e) => setNewControl({ ...newControl, description: e.target.value })}
                    placeholder="Enter description"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="controlQuestion">Control Question *</Label>
                  <Textarea
                    id="controlQuestion"
                    value={newControl.controlQuestion}
                    onChange={(e) => setNewControl({ ...newControl, controlQuestion: e.target.value })}
                    placeholder="Enter control question"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Functional Grouping *</Label>
                  <RadioGroup
                    value={newControl.functionalGrouping}
                    onValueChange={(v) => setNewControl({ ...newControl, functionalGrouping: v })}
                    className="grid grid-cols-3 gap-2 mt-2"
                  >
                    {FUNCTIONAL_GROUPINGS.map((g) => (
                      <div key={g} className="flex items-center space-x-2">
                        <RadioGroupItem value={g} id={`fg-${g}`} />
                        <Label htmlFor={`fg-${g}`} className="cursor-pointer">{g}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            )}

            {/* Step 2: Department, Owner, Assignee */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="departmentId">Department</Label>
                  <Select value={newControl.departmentId} onValueChange={(v) => setNewControl({ ...newControl, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ownerId">Owner</Label>
                  <Select value={newControl.ownerId} onValueChange={(v) => setNewControl({ ...newControl, ownerId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assigneeId">Assignee</Label>
                  <Select value={newControl.assigneeId} onValueChange={(v) => setNewControl({ ...newControl, assigneeId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredUsers().map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {createStep === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold">Review Your Selections</h3>
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
                    <span className="text-muted-foreground">Functional Grouping:</span>
                    <p className="font-medium">{newControl.functionalGrouping || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department:</span>
                    <p className="font-medium">{departments.find(d => d.id === newControl.departmentId)?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Owner:</span>
                    <p className="font-medium">{users.find(u => u.id === newControl.ownerId)?.fullName || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assignee:</span>
                    <p className="font-medium">{users.find(u => u.id === newControl.assigneeId)?.fullName || "-"}</p>
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
                if (importFileInputRef.current) {
                  importFileInputRef.current.value = "";
                }
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
    </div>
  );
}
