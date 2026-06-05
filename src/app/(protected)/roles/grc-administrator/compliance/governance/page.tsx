"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus,
  FileSpreadsheet,
  FileText,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Upload,
  Home,
  Search,
  Download,
} from "lucide-react";
import { Pagination as PaginationUI } from "@/components/ui/pagination";
import { isValidName } from "@/lib/validations";
import Link from "next/link";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

interface Policy {
  id: string;
  code: string;
  name: string;
  version: string;
  documentType: string;
  recurrence?: string;
  status: string;
  effectiveDate?: string;
  reviewDate?: string;
  aiReviewStatus?: string;
  aiReviewScore?: number;
  department?: { id: string; name: string };
  assignee?: { id: string; fullName: string };
  approver?: { id: string; fullName: string };
  _count?: { policyControls: number; attachments: number };
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string;
  customerCode?: string;
}

interface Framework {
  id: string;
  name: string;
  code: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  status: string;
  domain?: { id: string; name: string };
}

interface Domain {
  id: string;
  name: string;
}

const DOCUMENT_TYPES = ["Policy", "Standard", "Procedure"];
const RECURRENCE_OPTIONS = ["Weekly", "Monthly", "Quarterly", "Yearly"];

export default function GRCAdminGovernancePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.governance');
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDocType, setActiveDocType] = useState<string>("Policy");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const itemsPerPage = 20;

  // Filters
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  // Filter options
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  // Dynamic translations for user-entered data
  const { data: translatedPolicies } = useTranslatedData(policies, { modelName: 'Policy' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedUsers } = useTranslatedData(users, { modelName: 'User' });
  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: 'Framework' });
  const { data: translatedControls } = useTranslatedData(controls, { modelName: 'Control' });
  const { data: translatedDomains } = useTranslatedData(domains, { modelName: 'ControlDomain' });

  // Lookup maps for translated nested data
  const departmentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    translatedDepartments.forEach(d => map.set(d.id, d.name));
    return map;
  }, [translatedDepartments]);

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    translatedUsers.forEach(u => map.set(u.id, u.fullName));
    return map;
  }, [translatedUsers]);

  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [newPolicy, setNewPolicy] = useState({
    name: "",
    documentType: "Policy",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
  });

  const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});

  // Step 2 - Control linking
  const [selectedControlIds, setSelectedControlIds] = useState<string[]>([]);
  const [controlSearch, setControlSearch] = useState("");
  const [controlDomainFilter, setControlDomainFilter] = useState<string>("all");
  const [controlStatusFilter, setControlStatusFilter] = useState<string>("all");

  // Delete dialogs
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);

  // Import dialog
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editData, setEditData] = useState({
    name: "",
    documentType: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
  });

  useEffect(() => {
    fetchFilterOptions();
  }, [session?.user?.id]);

  useEffect(() => {
    fetchPolicies();
  }, [activeDocType, currentPage, frameworkFilter]);

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, userRes, frameworkRes, controlRes, domainRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/frameworks"),
        fetch("/api/controls"),
        fetch("/api/control-domains"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) {
        const userData = await userRes.json();
        setUsers(userData);
      }
      if (frameworkRes.ok) {
        const data = await frameworkRes.json();
        setFrameworks(Array.isArray(data) ? data : data.data || []);
      }
      if (controlRes.ok) {
        const data = await controlRes.json();
        setControls(Array.isArray(data) ? data : data.data || []);
      }
      if (domainRes.ok) {
        const data = await domainRes.json();
        setDomains(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", itemsPerPage.toString());
      params.set("documentType", activeDocType);
      if (frameworkFilter && frameworkFilter !== "all") params.set("frameworkId", frameworkFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  }, [activeDocType, currentPage, frameworkFilter, search]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchPolicies();
  };

  const handleCreatePolicy = async () => {
    try {
      const response = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPolicy,
          controlIds: selectedControlIds,
        }),
      });
      if (response.ok) {
        const responseData = await response.json().catch(() => null);
        if (responseData?.id) {
          triggerTranslation('Policy', responseData.id, { name: newPolicy.name });
        }
        setIsCreateDialogOpen(false);
        resetCreateDialog();
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error creating policy:", error);
    }
  };

  const resetCreateDialog = () => {
    setCreateStep(1);
    setPolicyErrors({});
    setNewPolicy({
      name: "",
      documentType: activeDocType,
      recurrence: "",
      departmentId: "",
      assigneeId: "",
    });
    setSelectedControlIds([]);
    setControlSearch("");
    setControlDomainFilter("all");
    setControlStatusFilter("all");
  };

  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;
    try {
      const response = await fetch(`/api/policies/${policyToDelete.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting policy:", error);
    } finally {
      setIsDeleteDialogOpen(false);
      setPolicyToDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const response = await fetch(`/api/policies/delete-all?documentType=${activeDocType}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting all policies:", error);
    } finally {
      setIsDeleteAllDialogOpen(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("documentType", activeDocType);

      const response = await fetch("/api/policies/import", {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        fetchPolicies();
        setIsImportDialogOpen(false);
        setImportFile(null);
      }
    } catch (error) {
      console.error("Error importing:", error);
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Published": return "bg-green-100 text-green-800";
      case "Approved": return "bg-blue-100 text-blue-800";
      case "Draft": return "bg-yellow-100 text-yellow-800";
      case "Needs Review": return "bg-orange-100 text-orange-800";
      case "Not Uploaded": return "bg-gray-100 text-gray-800";
      case "Pending Approval": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Filter controls for Step 2
  const filteredControls = translatedControls.filter((control) => {
    const matchesSearch = !controlSearch ||
      control.name.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase());
    const matchesDomain = controlDomainFilter === "all" || control.domain?.id === controlDomainFilter;
    const matchesStatus = controlStatusFilter === "all" || control.status === controlStatusFilter;
    return matchesSearch && matchesDomain && matchesStatus;
  });

  // Filter users for Assignee dropdown based on selected department
  const getFilteredUsers = () => {
    if (!newPolicy.departmentId) return [];
    return translatedUsers.filter((u) => {
      if (u.departmentId !== newPolicy.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  };

  // Filter users for Edit Assignee dropdown
  const getFilteredEditUsers = () => {
    if (!editData.departmentId) return [];
    return translatedUsers.filter((u) => {
      if (u.departmentId !== editData.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  };

  const openEditDialog = (policy: Policy) => {
    setEditingPolicy(policy);
    setEditErrors({});
    setEditData({
      name: policy.name,
      documentType: policy.documentType,
      recurrence: policy.recurrence || "",
      departmentId: policy.department?.id || "",
      assigneeId: policy.assignee?.id || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdatePolicy = async () => {
    if (!editingPolicy) return;
    const errors: Record<string, string> = {};
    if (editData.name && !isValidName(editData.name)) errors.name = t("Only letters, spaces, and hyphens are allowed");
    if (Object.keys(errors).length > 0) { setEditErrors(errors); return; }
    setEditErrors({});
    try {
      const response = await fetch(`/api/policies/${editingPolicy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (response.ok) {
        triggerTranslation('Policy', editingPolicy.id, { name: editData.name });
        setIsEditDialogOpen(false);
        setEditingPolicy(null);
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error updating policy:", error);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveDocType(tab);
    setCurrentPage(1);
    setSearch("");
    setFrameworkFilter("all");
  };

  const canProceedStep1 = newPolicy.name && newPolicy.departmentId && newPolicy.documentType && newPolicy.recurrence && newPolicy.assigneeId;

  // Pagination helpers
  const startItem = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, total);

  // Show loading while checking permissions
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
          <span className="text-primary-700 font-medium">{t("Governance")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Governance")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-slate-500">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user cannot view
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Governance.")} />;
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
        <span className="text-primary-700 font-medium">{t("Governance")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Governance")}</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeDocType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="Policy">{t("Policy")}</TabsTrigger>
          <TabsTrigger value="Standard">{t("Standards")}</TabsTrigger>
          <TabsTrigger value="Procedure">{t("Procedures")}</TabsTrigger>
        </TabsList>

        {/* Tab Content - Same structure for all tabs */}
        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-4 sm:mt-6">
            {/* Tab Sub-Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-slate-800">{t(docType === "Policy" ? "Policies" : docType === "Standard" ? "Standards" : "Procedures")}</h3>
                {total > 0 && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {total}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                <PermissionGate resource="compliance.governance" action="create">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setIsImportDialogOpen(true)}>
                    <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Import")}
                  </Button>
                </PermissionGate>
                {isGRCAdmin ? (
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => {
                    setNewPolicy({ ...newPolicy, documentType: activeDocType });
                    setIsCreateDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("New Governance")}
                  </Button>
                ) : (
                  <PermissionGate resource="compliance.governance" action="create">
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => {
                      setNewPolicy({ ...newPolicy, documentType: activeDocType });
                      setIsCreateDialogOpen(true);
                    }}>
                      <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {t("New Governance")}
                    </Button>
                  </PermissionGate>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
                <div className="relative w-full sm:w-[300px]">
                  <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t("Search by name or code...")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="w-full h-9 ltr:pl-9 rtl:pr-9 bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
                  />
                </div>
                <div className="ms-auto flex items-center gap-3 w-full sm:w-auto">
                  <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                    <SelectTrigger className="w-full sm:w-[200px] h-9 bg-slate-50 border-slate-200">
                      <SelectValue placeholder={t("Integrated Framework")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("Integrated Framework")}</SelectItem>
                      {translatedFrameworks.map((f) => (
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
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Code")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assignee")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Approver")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                        {t("Loading...")}
                      </TableCell>
                    </TableRow>
                  ) : policies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-0">
                        <div className="py-16 text-center">
                          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                            <FileText className="h-6 w-6 text-primary-500" />
                          </div>
                          <h3 className="text-base font-semibold text-slate-800 mb-1">
                            {t("No Documents Found")}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {t("No governance documents match your current filters.")}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    translatedPolicies.map((policy) => (
                      <TableRow
                        key={policy.id}
                        className="border-b border-slate-100 last:border-0 cursor-pointer"
                        onDoubleClick={() => router.push(`/roles/grc-administrator/compliance/governance/${policy.id}`)}
                      >
                        <TableCell className="py-3 pl-5 text-sm font-medium text-slate-900">{policy.code}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{policy.name}</TableCell>
                        <TableCell className="py-3">
                          <Badge className={getStatusBadgeColor(policy.status)}>
                            {policy.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{(policy.assignee?.id ? userNameMap.get(policy.assignee.id) : null) || policy.assignee?.fullName || "-"}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{(policy.approver?.id ? userNameMap.get(policy.approver.id) : null) || policy.approver?.fullName || "-"}</TableCell>
                        <TableCell className="py-3 text-sm text-slate-700">{(policy.department?.id ? departmentNameMap.get(policy.department.id) : null) || policy.department?.name || "-"}</TableCell>
                        <TableCell className="py-3 pr-5">
                          <div className="flex items-center gap-0.5">
                            <PermissionGate resource="compliance.governance" action="edit">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(policy);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate resource="compliance.governance" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPolicyToDelete(policy);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
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
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog - 3 Steps */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateDialog();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Governance")} - {t("Step")} {createStep} {t("of")} 3</DialogTitle>
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

            {/* Step 1: Basic Information */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Governance Name")} *</Label>
                  <Input
                    value={newPolicy.name}
                    onChange={(e) => {
                      setNewPolicy({ ...newPolicy, name: e.target.value });
                      if (policyErrors.name) setPolicyErrors((prev) => { const { name, ...rest } = prev; return rest; });
                    }}
                    placeholder={t("Enter governance name")}
                    className={`mt-1.5 w-full ${policyErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {policyErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{policyErrors.name}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")} *</Label>
                  <Select value={newPolicy.departmentId} onValueChange={(v) => {
                    setNewPolicy({ ...newPolicy, departmentId: v, assigneeId: "" });
                    if (policyErrors.departmentId) setPolicyErrors((prev) => { const { departmentId, ...rest } = prev; return rest; });
                  }}>
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {translatedDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {policyErrors.departmentId && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{policyErrors.departmentId}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Document Type")} *</Label>
                  <Select value={newPolicy.documentType} onValueChange={(v) => {
                    setNewPolicy({ ...newPolicy, documentType: v });
                    if (policyErrors.documentType) setPolicyErrors((prev) => { const { documentType, ...rest } = prev; return rest; });
                  }}>
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.documentType ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select document type")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {DOCUMENT_TYPES.map((docType) => (
                        <SelectItem key={docType} value={docType}>{t(docType)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {policyErrors.documentType && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{policyErrors.documentType}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Recurrence")} *</Label>
                  <Select value={newPolicy.recurrence} onValueChange={(v) => {
                    setNewPolicy({ ...newPolicy, recurrence: v });
                    if (policyErrors.recurrence) setPolicyErrors((prev) => { const { recurrence, ...rest } = prev; return rest; });
                  }}>
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.recurrence ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select recurrence")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {policyErrors.recurrence && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{policyErrors.recurrence}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Assignee")} *</Label>
                  <Select
                    value={newPolicy.assigneeId}
                    onValueChange={(v) => {
                      setNewPolicy({ ...newPolicy, assigneeId: v });
                      if (policyErrors.assigneeId) setPolicyErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; });
                    }}
                    disabled={!newPolicy.departmentId}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={
                        !newPolicy.departmentId
                          ? t("Select department first")
                          : t("Select assignee")
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      {getFilteredUsers().length > 0 ? (
                        getFilteredUsers().map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-slate-500 text-center">
                          {t("No department reviewers found")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {policyErrors.assigneeId && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{policyErrors.assigneeId}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <Label className="text-base font-semibold text-slate-800">{t("Select Controls to Link")}</Label>
                  <Badge variant="secondary">{selectedControlIds.length} {t("selected")}</Badge>
                </div>

                {/* Control Filters */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder={t("Search controls...")}
                      value={controlSearch}
                      onChange={(e) => setControlSearch(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white">
                      <SelectValue placeholder={t("Domain")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Domains")}</SelectItem>
                      {translatedDomains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlStatusFilter} onValueChange={setControlStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white">
                      <SelectValue placeholder={t("Status")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">{t("All Statuses")}</SelectItem>
                      <SelectItem value="Compliant">{t("Compliant")}</SelectItem>
                      <SelectItem value="Non Compliant">{t("Non Compliant")}</SelectItem>
                      <SelectItem value="Not Applicable">{t("Not Applicable")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controls Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[300px] overflow-y-auto overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                        <TableHead className="w-[50px] py-3 pl-5"></TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Control Code")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Control Name")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Domain")}</TableHead>
                        <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="border-b border-slate-100 last:border-0">
                          <TableCell className="py-3 pl-5">
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedControlIds([...selectedControlIds, control.id]);
                                } else {
                                  setSelectedControlIds(selectedControlIds.filter((id) => id !== control.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="py-3 text-sm font-medium text-slate-900">{control.controlCode}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{control.name}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{control.domain?.name || "-"}</TableCell>
                          <TableCell className="py-3 pr-5">
                            <Badge className={getStatusBadgeColor(control.status)}>
                              {control.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-sm text-slate-500">
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
                    <Label className="text-slate-500 text-sm">{t("Governance Name")}</Label>
                    <p className="font-medium text-slate-900">{newPolicy.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Document Type")}</Label>
                    <p className="font-medium text-slate-900">{t(newPolicy.documentType)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Recurrence")}</Label>
                    <p className="font-medium text-slate-900">{t(newPolicy.recurrence)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Department")}</Label>
                    <p className="font-medium text-slate-900">
                      {translatedDepartments.find((d) => d.id === newPolicy.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Assignee")}</Label>
                    <p className="font-medium text-slate-900">
                      {translatedUsers.find((u) => u.id === newPolicy.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">{t("Linked Controls")}</Label>
                    <p className="font-medium text-slate-900">{selectedControlIds.length} {t("controls")}</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-sm mb-2 block">{t("Selected Controls")}:</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedControlIds.map((id) => {
                        const control = translatedControls.find((c) => c.id === id);
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
          <div className="flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateDialog();
                setIsCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            <Button
              onClick={() => {
                if (createStep === 1) {
                  const errors: Record<string, string> = {};
                  if (!newPolicy.name) errors.name = t("Please enter the policy name");
                  else if (!isValidName(newPolicy.name)) errors.name = t("Only letters, spaces, and hyphens are allowed");
                  if (!newPolicy.departmentId) errors.departmentId = t("Please select the Department");
                  if (!newPolicy.documentType) errors.documentType = t("Please select the document type");
                  if (!newPolicy.recurrence) errors.recurrence = t("Please select the recurrence");
                  if (!newPolicy.assigneeId) errors.assigneeId = t("Please select the assignee");
                  if (Object.keys(errors).length > 0) { setPolicyErrors(errors); return; }
                  setPolicyErrors({});
                }
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreatePolicy();
              }}
            >
              {createStep === 3 ? `${t("Create")} ${t(newPolicy.documentType)}` : t("Next")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Policy Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete")} {t(policyToDelete?.documentType || "Policy")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete")} &quot;{policyToDelete?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel onClick={() => setPolicyToDelete(null)}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePolicy} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Delete All")} {t(activeDocType)}s</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete all items?")} {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center ltr:justify-end rtl:justify-start gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
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
                {t("Import")} {t(activeDocType)}s
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-4 sm:px-6 py-6">
            <p className="text-sm text-slate-500 mb-4">
              {t("Upload a CSV or Excel file to import items.")}
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
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    id="import-file"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        setImportFile(files[0]);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              {t("Import")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setEditingPolicy(null);
        }
        setIsEditDialogOpen(open);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Sticky Header */}
          <div className="px-4 sm:px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit")} {t(editingPolicy?.documentType || "Governance")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Governance Name")} *</Label>
                <Input
                  value={editData.name}
                  onChange={(e) => {
                    setEditData({ ...editData, name: e.target.value });
                    if (editErrors.name) setEditErrors((prev) => { const { name, ...rest } = prev; return rest; });
                  }}
                  placeholder={t("Enter governance name")}
                  className={`mt-1.5 w-full ${editErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                />
                {editErrors.name && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{editErrors.name}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department")} *</Label>
                <Select value={editData.departmentId} onValueChange={(v) => setEditData({ ...editData, departmentId: v, assigneeId: "" })}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {translatedDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Document Type")} *</Label>
                <Select value={editData.documentType} onValueChange={(v) => setEditData({ ...editData, documentType: v })}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select document type")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {DOCUMENT_TYPES.map((docType) => (
                      <SelectItem key={docType} value={docType}>{t(docType)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Recurrence")} *</Label>
                <Select value={editData.recurrence} onValueChange={(v) => setEditData({ ...editData, recurrence: v })}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select recurrence")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {RECURRENCE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{t(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Assignee")} *</Label>
                <Select
                  value={editData.assigneeId}
                  onValueChange={(v) => setEditData({ ...editData, assigneeId: v })}
                  disabled={!editData.departmentId}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={
                      !editData.departmentId
                        ? t("Select department first")
                        : t("Select assignee")
                    } />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-white max-h-[200px] overflow-y-auto">
                    {getFilteredEditUsers().length > 0 ? (
                      getFilteredEditUsers().map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-2 text-sm text-slate-500 text-center">
                        {t("No department reviewers found")}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex ltr:justify-end rtl:justify-start gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingPolicy(null);
            }}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleUpdatePolicy}
              disabled={!editData.name || !editData.departmentId || !editData.documentType || !editData.recurrence}
            >
              {t("Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
