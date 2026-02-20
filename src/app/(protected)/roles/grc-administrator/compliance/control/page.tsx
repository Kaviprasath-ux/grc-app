"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Shield,
} from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { isValidName } from "@/lib/validations";
import Link from "next/link";

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

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
  customerCode?: string;
}

const FUNCTIONAL_GROUPINGS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

const ITEMS_PER_PAGE = 20;

/**
 * GRC Administrator Controls Page
 *
 * This page is specifically for GRC Administrators and provides access to controls
 * across all customers (broader scope than Customer Admin).
 */
export default function GRCAdminControlListPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.controls');
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Filters
  const [integratedFrameworkFilter, setIntegratedFrameworkFilter] = useState<string>("all");

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

  useEffect(() => {
    fetchFilterOptions();
  }, [session?.user?.id]);

  useEffect(() => {
    fetchControls();
  }, [currentPage, integratedFrameworkFilter]);

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
  }, [currentPage, integratedFrameworkFilter, search]);

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
        toast({ title: t("Success"), description: t("Successfully imported") + ` ${result.imported} ` + t("control(s)") });
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchControls();
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: t("Import failed") + `: ${error.message || t("Unknown error")}`, variant: "destructive" });
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
    const headers = [t("Control Code"), t("Control Name"), t("Description"), t("Control Question"), t("Functional Grouping"), t("Domain"), t("Department"), t("Owner"), t("Assignee"), t("Status")];
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

  // GRC Admin has access to all users and departments (no customer scoping)
  const getFilteredUsers = () => {
    if (!newControl.departmentId) return users;
    return users.filter((u) => u.departmentId === newControl.departmentId);
  };

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-500">{t("Compliance")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Controls")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Controls")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-slate-500">{t("Loading...")}</p>
          </div>
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
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-slate-500">{t("Compliance")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Controls")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Controls")}</h1>
          {total > 0 && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <PermissionGate resource="compliance.controls" action="create">
            <Button size="sm" onClick={handleImport} variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Import")}
            </Button>
          </PermissionGate>
          {isGRCAdmin ? (
            <Button size="sm" className="w-full sm:w-auto" onClick={() => { setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" }); setControlErrors({}); setCreateStep(1); setIsCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("New Control")}
            </Button>
          ) : (
            <PermissionGate resource="compliance.controls" action="create">
              <Button size="sm" className="w-full sm:w-auto" onClick={() => { setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" }); setControlErrors({}); setCreateStep(1); setIsCreateDialogOpen(true); }}>
                <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("New Control")}
              </Button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search by control code or name...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full h-9 ltr:pl-9 rtl:pr-9 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <Select value={integratedFrameworkFilter} onValueChange={setIntegratedFrameworkFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-9 bg-slate-50 border-slate-200">
              <SelectValue placeholder={t("Integrated Framework")} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
              <SelectItem value="all">{t("All Frameworks")}</SelectItem>
              {frameworks.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              {visibleColumns.controlName && (
                <TableHead
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5 cursor-pointer select-none"
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
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer select-none"
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
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer select-none"
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
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    {t("Status")}
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              {visibleColumns.assignee && (
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assignee")}</TableHead>
              )}
              {visibleColumns.domain && (
                <TableHead
                  className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 cursor-pointer select-none"
                  onClick={() => handleSort("domain")}
                >
                  <div className="flex items-center gap-2">
                    {t("Domain Name")}
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </TableHead>
              )}
              <TableHead className="w-[50px] py-3 pr-5">
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
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                  {t("Loading...")}
                </TableCell>
              </TableRow>
            ) : sortedControls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <Shield className="h-6 w-6 text-primary-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      {t("No Controls Found")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t("No controls match your current filters.")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedControls.map((control) => (
                <TableRow
                  key={control.id}
                  className="border-b border-slate-100 last:border-0 cursor-pointer"
                  onDoubleClick={() => router.push(`/roles/grc-administrator/compliance/control/${control.id}`)}
                >
                  {visibleColumns.controlName && (
                    <TableCell className="py-3 pl-5 text-sm font-medium text-slate-900">{control.name}</TableCell>
                  )}
                  {visibleColumns.controlCode && (
                    <TableCell className="py-3 text-sm text-slate-700">{control.controlCode}</TableCell>
                  )}
                  {visibleColumns.functionalGrouping && (
                    <TableCell className="py-3 text-sm text-slate-700">{control.functionalGrouping || "-"}</TableCell>
                  )}
                  {visibleColumns.status && (
                    <TableCell className="py-3 text-sm text-slate-700">{control.status}</TableCell>
                  )}
                  {visibleColumns.assignee && (
                    <TableCell className="py-3 text-sm text-slate-700">{control.assignee?.fullName || "-"}</TableCell>
                  )}
                  {visibleColumns.domain && (
                    <TableCell className="py-3 text-sm text-slate-700">{control.domain?.name || "-"}</TableCell>
                  )}
                  <TableCell className="py-3 pr-5"></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <PaginationUI
          currentPage={currentPage + 1}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={(page) => setCurrentPage(page - 1)}
        />
      </div>

      {/* Create Control Dialog - 3 Step Wizard */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { if (!open) { setIsCreateDialogOpen(false); setCreateStep(1); setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" }); setControlErrors({}); } else { setIsCreateDialogOpen(true); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Control")} - {t("Step")} {createStep} {t("of")} 3</DialogTitle>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Control Domain")} <span className="text-error">*</span></Label>
                      <Select value={newControl.domainId} onValueChange={(v) => { setNewControl({ ...newControl, domainId: v }); if (controlErrors.domainId) setControlErrors((prev) => { const { domainId, ...rest } = prev; return rest; }); }}>
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.domainId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select domain")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {domains.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {controlErrors.domainId && (
                        <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                          <p className="text-sm text-red-600">{controlErrors.domainId}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Function Grouping")} <span className="text-error">*</span></Label>
                      <Select value={newControl.functionalGrouping} onValueChange={(v) => { setNewControl({ ...newControl, functionalGrouping: v }); if (controlErrors.functionalGrouping) setControlErrors((prev) => { const { functionalGrouping, ...rest } = prev; return rest; }); }}>
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.functionalGrouping ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select grouping")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {FUNCTIONAL_GROUPINGS.map((g) => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
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
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">{t("Department")} <span className="text-error">*</span></Label>
                      <Select value={newControl.departmentId} onValueChange={(v) => { setNewControl({ ...newControl, departmentId: v, assigneeId: "" }); if (controlErrors.departmentId) setControlErrors((prev) => { const { departmentId, ...rest } = prev; return rest; }); }}>
                        <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                          <SelectValue placeholder={t("Select department")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {departments.map((d) => (
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
                      <Label className="text-sm font-medium text-slate-700">{t("Owner")}</Label>
                      <Select value={newControl.ownerId} onValueChange={(v) => setNewControl({ ...newControl, ownerId: v })}>
                        <SelectTrigger className="mt-1.5 bg-white w-full">
                          <SelectValue placeholder={t("Select owner")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Assignee")} <span className="text-error">*</span></Label>
                    <Select value={newControl.assigneeId} onValueChange={(v) => { setNewControl({ ...newControl, assigneeId: v }); if (controlErrors.assigneeId) setControlErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; }); }}>
                      <SelectTrigger className={`mt-1.5 bg-white w-full ${controlErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select assignee")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                        {getFilteredUsers().map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {controlErrors.assigneeId && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{controlErrors.assigneeId}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {createStep === 3 && (
                <div className="space-y-4">
                  <h4 className="font-semibold">{t("Review informations")}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
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
                      <span className="text-slate-400">{t("Function Grouping")}:</span>
                      <p className="font-medium">{newControl.functionalGrouping || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Department")}:</span>
                      <p className="font-medium">{departments.find(d => d.id === newControl.departmentId)?.name || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Owner")}:</span>
                      <p className="font-medium">{users.find(u => u.id === newControl.ownerId)?.fullName || "-"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">{t("Assignee")}:</span>
                      <p className="font-medium">{users.find(u => u.id === newControl.assigneeId)?.fullName || "-"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                setIsCreateDialogOpen(false);
                setCreateStep(1);
                setNewControl({ name: "", description: "", controlQuestion: "", functionalGrouping: "", domainId: "", departmentId: "", ownerId: "", assigneeId: "" });
                setControlErrors({});
              }
            }}>
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button onClick={() => {
              if (createStep === 1) {
                const errors: Record<string, string> = {};
                if (!newControl.domainId) errors.domainId = t("Please select the Control Domain");
                if (!newControl.name.trim()) errors.name = t("Please enter name");
                else if (!isValidName(newControl.name)) errors.name = t("Only letters, spaces, and hyphens are allowed");
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
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Controls")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-4">
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
                {t("Supported formats")}: CSV, XLSX, XLS
              </p>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
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
    </div>
  );
}
