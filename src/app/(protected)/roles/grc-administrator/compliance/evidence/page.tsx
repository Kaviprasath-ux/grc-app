"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  FileSpreadsheet,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Home,
  Search,
  Download,
} from "lucide-react";
import Link from "next/link";
import { isValidName } from "@/lib/validations";
import { Pagination as PaginationUI } from "@/components/ui/pagination";

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  domain: string | null;
  recurrence: string | null;
  status: string;
  departmentId: string | null;
  assigneeId: string | null;
  department?: { id: string; name: string } | null;
  assignee?: { id: string; fullName: string } | null;
  customerAccount?: { id: string; code: string; name: string } | null;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  entities: string;
  domain?: { id: string; name: string } | null;
  framework?: { id: string; name: string } | null;
  functionalGrouping: string | null;
}

interface Department {
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
  departmentId: string | null;
  customerCode?: string;
  userRoles?: UserRole[];
}

interface CustomerAccount {
  id: string;
  code: string;
  name: string;
}

interface Framework {
  id: string;
  name: string;
}

interface ControlDomain {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  "Not Uploaded": "bg-slate-100 text-slate-600",
  Draft: "bg-warning-light text-warning-dark",
  Validated: "bg-info-light text-info-dark",
  Published: "bg-success-light text-success-dark",
  "Need Attention": "bg-error-light text-error-dark",
};

const recurrenceOptions = ["Yearly", "Half-yearly", "Quarterly", "Monthly"];

export default function GRCAdminEvidencePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { canView, canCreate, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.evidence');
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);

  // Import dialog states
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Delete dialogs
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);
  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccount[]>([]);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
    customerAccountId: "",
  });

  // Step 2 - Control selection
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [evidenceErrors, setEvidenceErrors] = useState<Record<string, string>>({});
  const [controlFilters, setControlFilters] = useState({
    domainId: "",
    frameworkId: "",
    functionalGrouping: "",
    search: "",
  });

  const fetchEvidences = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (frameworkFilter && frameworkFilter !== "all") params.append("frameworkId", frameworkFilter);
      if (customerFilter && customerFilter !== "all") params.append("customerAccountId", customerFilter);
      if (searchTerm) params.append("search", searchTerm);
      params.append("page", currentPage.toString());
      params.append("limit", itemsPerPage.toString());

      const response = await fetch(`/api/evidences?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEvidences(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  }, [frameworkFilter, customerFilter, searchTerm, currentPage]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [deptRes, usersRes, fwRes, controlsRes, domainsRes, customerRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/frameworks"),
        fetch("/api/controls?limit=500"),
        fetch("/api/control-domains"),
        fetch("/api/customer-accounts"),
      ]);

      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.data || data || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        const userData = data.data || data || [];
        setUsers(userData);
      }
      if (fwRes.ok) {
        const data = await fwRes.json();
        setFrameworks(data.data || data || []);
      }
      if (controlsRes.ok) {
        const data = await controlsRes.json();
        setControls(data.data || data || []);
      }
      if (domainsRes.ok) {
        const data = await domainsRes.json();
        setControlDomains(data.data || data || []);
      }
      if (customerRes.ok) {
        const data = await customerRes.json();
        setCustomerAccounts(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    fetchEvidences();
  }, [fetchEvidences]);

  // Filter users by selected customer account (for GRC Admin)
  const filteredUsers = (() => {
    if (!createForm.customerAccountId) return users;
    const customerCode = customerAccounts.find(c => c.id === createForm.customerAccountId)?.code;
    return users.filter((u) => u.customerCode === customerCode);
  })();

  // Filter departments by selected customer account (for GRC Admin)
  const filteredDepartments = (() => {
    if (!createForm.customerAccountId) return departments;
    const customerCode = customerAccounts.find(c => c.id === createForm.customerAccountId)?.code;
    const customerUserDeptIds = new Set(
      users
        .filter((u) => u.customerCode === customerCode && u.departmentId)
        .map((u) => u.departmentId)
    );
    return departments.filter((d) => customerUserDeptIds.has(d.id));
  })();

  // Filter users by department and role
  const departmentFilteredUsers = (() => {
    if (!createForm.departmentId) return [];
    return filteredUsers.filter((u) => {
      if (u.departmentId !== createForm.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  })();

  // Filtered controls for step 2
  const filteredControls = controls.filter((c) => {
    if (controlFilters.domainId && c.domain?.id !== controlFilters.domainId) return false;
    if (controlFilters.frameworkId && c.framework?.id !== controlFilters.frameworkId) return false;
    if (controlFilters.functionalGrouping && c.functionalGrouping !== controlFilters.functionalGrouping) return false;
    if (controlFilters.search) {
      const search = controlFilters.search.toLowerCase();
      if (!c.controlCode.toLowerCase().includes(search) && !c.name.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const handleSearch = () => {
    setCurrentPage(1);
    fetchEvidences();
  };

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/evidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          recurrence: createForm.recurrence,
          departmentId: createForm.departmentId || null,
          assigneeId: createForm.assigneeId || null,
          customerAccountId: createForm.customerAccountId || null,
          controlIds: selectedControlIds,
          status: "Not Uploaded",
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error creating evidence:", error);
    }
  };

  const resetCreateForm = () => {
    setCreateStep(1);
    setCreateForm({
      name: "",
      description: "",
      recurrence: "",
      departmentId: "",
      assigneeId: "",
      customerAccountId: "",
    });
    setSelectedControlIds([]);
    setControlFilters({
      domainId: "",
      frameworkId: "",
      functionalGrouping: "",
      search: "",
    });
    setEvidenceErrors({});
  };

  const handleDeleteAll = async () => {
    try {
      const params = new URLSearchParams();
      if (customerFilter && customerFilter !== "all") {
        params.set("customerAccountId", customerFilter);
      }
      const response = await fetch(`/api/evidences/delete-all?${params.toString()}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error deleting all evidences:", error);
    } finally {
      setIsDeleteAllDialogOpen(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setImportFile(files[0]);
    }
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
      if (createForm.customerAccountId) {
        formData.append("customerAccountId", createForm.customerAccountId);
      }

      const response = await fetch("/api/evidences/import", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchEvidences();
      }
    } catch (error) {
      console.error("Error importing evidences:", error);
    } finally {
      setImporting(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  };

  const toggleControlSelection = (controlId: string) => {
    setSelectedControlIds((prev) =>
      prev.includes(controlId)
        ? prev.filter((id) => id !== controlId)
        : [...prev, controlId]
    );
  };

  const canProceedStep1 = createForm.name && createForm.recurrence && createForm.departmentId && createForm.assigneeId && createForm.customerAccountId;

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Compliance")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Evidence")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Evidence")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user is not GRC Admin or doesn't have view permission
  if (!isGRCAdmin || !canView) {
    return <Unauthorized description={t("You don't have permission to access GRC Admin Evidence.")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("GRC")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-slate-500">{t("Compliance")}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Evidence")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Evidence")}</h1>
          {/* count badge */}
          {/* {total > 0 && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {total}
            </span>
          )} */}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <PermissionGate resource="compliance.evidence" action="delete">
            <Button variant="outline" size="sm" className="w-full sm:w-auto text-semantic-error hover:text-semantic-error hover:bg-red-50" onClick={() => setIsDeleteAllDialogOpen(true)}>
              <Trash2 className="h-4 w-4 me-2" />
              {t("Delete All")}
            </Button>
          </PermissionGate>
          <PermissionGate resource="compliance.evidence" action="create">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsImportDialogOpen(true)}>
              <Download className="h-4 w-4 me-2" />
              {t("Import")}
            </Button>
          </PermissionGate>
          <PermissionGate resource="compliance.evidence" action="create">
            <Button size="sm" className="col-span-2 sm:col-span-1 w-full sm:w-auto" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              {t("New Evidence")}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative w-full sm:w-[300px]">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t("Search by name, domain or assignee...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="ms-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("All Customers")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("All Customers")}</SelectItem>
                {customerAccounts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Framework")} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                <SelectItem value="all">{t("All Frameworks")}</SelectItem>
                {frameworks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Evidence Code")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Evidence Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Customer")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Domain")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assignee")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5">{t("Department")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                  {t("Loading...")}
                </TableCell>
              </TableRow>
            ) : evidences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-6 w-6 text-primary-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      {t("No Evidence Found")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t("No evidence records match your current filters.")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              evidences.map((evidence) => (
                <TableRow
                  key={evidence.id}
                  className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  onDoubleClick={() => router.push(`/compliance/evidence/${evidence.id}`)}
                >
                  <TableCell className="py-3.5 ps-5 text-sm font-medium text-slate-800">{evidence.evidenceCode}</TableCell>
                  <TableCell className="py-3.5 text-sm text-slate-600">{evidence.name}</TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className="text-xs">
                      {evidence.customerAccount?.name || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-slate-600">{evidence.domain || "-"}</TableCell>
                  <TableCell className="py-3.5">
                    <Badge className={statusColors[evidence.status] || "bg-slate-100 text-slate-600"}>
                      {t(evidence.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-slate-600">{evidence.assignee?.fullName || "-"}</TableCell>
                  <TableCell className="py-3.5 pe-5 text-sm text-slate-600">{evidence.department?.name || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        <PaginationUI
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Create Evidence Dialog - 3 Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateForm();
        setCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Evidence")} - {t("Step")} {createStep} {t("of")} 3</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 pb-5">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === createStep
                      ? "bg-primary text-primary-foreground"
                      : step < createStep
                      ? "bg-green-500 text-white"
                      : "bg-muted text-slate-400"
                  }`}>
                    {step < createStep ? <Check className="h-4 w-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-1 mx-2 ${step < createStep ? "bg-green-500" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Basic Information */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Customer Account")} *</Label>
                  <Select value={createForm.customerAccountId} onValueChange={(v) => {
                    setCreateForm({ ...createForm, customerAccountId: v, departmentId: "", assigneeId: "" });
                    if (evidenceErrors.customerAccountId) setEvidenceErrors((prev) => { const { customerAccountId, ...rest } = prev; return rest; });
                  }}>
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${evidenceErrors.customerAccountId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select customer account")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {customerAccounts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {evidenceErrors.customerAccountId && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{evidenceErrors.customerAccountId}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Evidence Requirement")} *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, name: e.target.value });
                      if (evidenceErrors.name) setEvidenceErrors((prev) => { const { name, ...rest } = prev; return rest; });
                    }}
                    placeholder={t("Enter evidence requirement")}
                    className={`mt-1.5 w-full ${evidenceErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {evidenceErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{evidenceErrors.name}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Recurrence")} *</Label>
                  <Select value={createForm.recurrence} onValueChange={(v) => {
                    setCreateForm({ ...createForm, recurrence: v });
                    if (evidenceErrors.recurrence) setEvidenceErrors((prev) => { const { recurrence, ...rest } = prev; return rest; });
                  }}>
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${evidenceErrors.recurrence ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select recurrence")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {recurrenceOptions.map((r) => (
                        <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {evidenceErrors.recurrence && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{evidenceErrors.recurrence}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")} *</Label>
                  <Select
                    value={createForm.departmentId}
                    onValueChange={(v) => {
                      setCreateForm({ ...createForm, departmentId: v, assigneeId: "" });
                      if (evidenceErrors.departmentId) setEvidenceErrors((prev) => { const { departmentId, ...rest } = prev; return rest; });
                    }}
                    disabled={!createForm.customerAccountId}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${evidenceErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={
                        !createForm.customerAccountId
                          ? t("Select customer account first")
                          : t("Select department")
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {filteredDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {evidenceErrors.departmentId && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{evidenceErrors.departmentId}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Assignee")} *</Label>
                  <Select
                    value={createForm.assigneeId}
                    onValueChange={(v) => {
                      setCreateForm({ ...createForm, assigneeId: v });
                      if (evidenceErrors.assigneeId) setEvidenceErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; });
                    }}
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${evidenceErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={
                        !createForm.departmentId
                          ? t("Select department first")
                          : t("Select assignee")
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {departmentFilteredUsers.length > 0 ? (
                        departmentFilteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-slate-500 text-center">
                          {t("No department reviewers found")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {evidenceErrors.assigneeId && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{evidenceErrors.assigneeId}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder={t("Enter description")}
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-800">{t("Select Controls to Link")}</Label>
                  <Badge variant="secondary">{selectedControlIds.length} {t("selected")}</Badge>
                </div>

                {/* Control Filters */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={t("Search controls...")}
                      value={controlFilters.search}
                      onChange={(e) => setControlFilters({ ...controlFilters, search: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <Select value={controlFilters.domainId || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, domainId: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white">
                      <SelectValue placeholder={t("Domain")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Domains")}</SelectItem>
                      {controlDomains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlFilters.functionalGrouping || "all"} onValueChange={(v) => setControlFilters({ ...controlFilters, functionalGrouping: v === "all" ? "" : v })}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white">
                      <SelectValue placeholder={t("Functional Grouping")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Groupings")}</SelectItem>
                      <SelectItem value="Govern">{t("Govern")}</SelectItem>
                      <SelectItem value="Identify">{t("Identify")}</SelectItem>
                      <SelectItem value="Protect">{t("Protect")}</SelectItem>
                      <SelectItem value="Detect">{t("Detect")}</SelectItem>
                      <SelectItem value="Respond">{t("Respond")}</SelectItem>
                      <SelectItem value="Recover">{t("Recover")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controls Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[50px] py-3 pl-5"></TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Control Code")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Control Name")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Domain")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="border-b border-slate-100 last:border-0 cursor-pointer" onClick={() => toggleControlSelection(control.id)}>
                          <TableCell className="py-3 pl-5">
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={() => toggleControlSelection(control.id)}
                            />
                          </TableCell>
                          <TableCell className="py-3 text-sm font-medium text-slate-900">{control.controlCode}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{control.name}</TableCell>
                          <TableCell className="py-3 pr-5 text-sm text-slate-700">{control.domain?.name || "-"}</TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-sm text-slate-500">
                            {t("No controls found")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {createStep === 3 && (
              <div className="space-y-4 sm:space-y-6">
                <div className="text-lg font-medium text-slate-800">{t("Review Information")}</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Customer Account")}</Label>
                    <p className="font-medium text-slate-900">
                      {customerAccounts.find((c) => c.id === createForm.customerAccountId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Evidence Name")}</Label>
                    <p className="font-medium text-slate-900">{createForm.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Recurrence")}</Label>
                    <p className="font-medium text-slate-900">{createForm.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Department")}</Label>
                    <p className="font-medium text-slate-900">
                      {filteredDepartments.find((d) => d.id === createForm.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Assignee")}</Label>
                    <p className="font-medium text-slate-900">
                      {filteredUsers.find((u) => u.id === createForm.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Linked Controls")}</Label>
                    <p className="font-medium text-slate-900">{selectedControlIds.length} {t("controls")}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-slate-500 text-sm">{t("Description")}</Label>
                    <p className="font-medium text-slate-900">{createForm.description || "-"}</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-sm mb-2 block">{t("Selected Controls")}:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedControlIds.map((id) => {
                        const control = controls.find((c) => c.id === id);
                        return control ? (
                          <Badge key={id} variant="outline">
                            {control.controlCode}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateForm();
                setCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button
              onClick={() => {
                if (createStep === 1) {
                  const errors: Record<string, string> = {};
                  if (!createForm.customerAccountId) errors.customerAccountId = t("Please select the customer account");
                  if (!createForm.name) errors.name = t("Please enter the evidence name");
                  else if (!isValidName(createForm.name)) errors.name = t("Only letters, numbers, spaces, and hyphens are allowed");
                  if (!createForm.recurrence) errors.recurrence = t("Please select the recurrence");
                  if (!createForm.departmentId) errors.departmentId = t("Please select the Department");
                  if (!createForm.assigneeId) errors.assigneeId = t("Please select the assignee");
                  if (Object.keys(errors).length > 0) { setEvidenceErrors(errors); return; }
                  setEvidenceErrors({});
                }
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreate();
              }}
            >
              {createStep === 3 ? t("Create Evidence") : t("Next")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete All Evidence")}</AlertDialogTitle>
            <AlertDialogDescription>
              {customerFilter !== "all"
                ? t("Are you sure you want to delete all evidence records for the selected customer? This action cannot be undone.")
                : t("Are you sure you want to delete all evidence records? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              {t("Delete All")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                {t("Import Evidence")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Customer Account")} *</Label>
              <Select value={createForm.customerAccountId} onValueChange={(v) => setCreateForm({ ...createForm, customerAccountId: v })}>
                <SelectTrigger className="mt-1.5 w-full bg-white">
                  <SelectValue placeholder={t("Select customer account")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                  {customerAccounts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-slate-500">
              {t("Upload a CSV or Excel file to import evidence records.")}
            </p>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? "border-primary bg-primary-50" : "border-slate-200 hover:border-slate-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("import-file")?.click()}
            >
              {importFile ? (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-green-600" />
                  <p className="font-medium text-slate-800">{importFile.name}</p>
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    setImportFile(null);
                  }}>
                    {t("Remove")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300" />
                  <div>
                    <p className="text-sm text-slate-600">
                      {t("Drag and drop a file here, or click to browse")}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t("Supported formats")}: CSV, XLSX, XLS
                    </p>
                  </div>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="import-file"
                    onChange={handleImportFileChange}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleImportSubmit} disabled={!importFile || !createForm.customerAccountId || importing}>
              {importing ? t("Importing...") : t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
