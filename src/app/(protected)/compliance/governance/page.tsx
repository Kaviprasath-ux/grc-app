"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
} from "lucide-react";

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

export default function GovernancePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.governance');
  const isCustomerAdmin = useHasRole("CustomerAdministrator");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
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
  const filteredControls = controls.filter((control) => {
    const matchesSearch = !controlSearch ||
      control.name.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase());
    const matchesDomain = controlDomainFilter === "all" || control.domain?.id === controlDomainFilter;
    const matchesStatus = controlStatusFilter === "all" || control.status === controlStatusFilter;
    return matchesSearch && matchesDomain && matchesStatus;
  });

  // The /api/users and /api/departments endpoints already apply tenant filtering,
  // so data is already scoped to the user's customerAccountId.
  const getCustomerScopedUsers = () => users;

  const getCustomerScopedDepartments = () => departments;

  // Filter users for Assignee dropdown: only DepartmentReviewers and DepartmentContributors from the selected department
  const filteredUsers = (() => {
    if (!newPolicy.departmentId) return [];

    return users.filter((u) => {
      if (u.departmentId !== newPolicy.departmentId) return false;
      return u.userRoles?.some((ur) =>
        ["DepartmentReviewer", "DepartmentContributor"].includes(ur.role?.name)
      );
    });
  })();

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user cannot view
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Governance." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Governance</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeDocType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="Policy">Policy</TabsTrigger>
          <TabsTrigger value="Standard">Standards</TabsTrigger>
          <TabsTrigger value="Procedure">Procedures</TabsTrigger>
        </TabsList>

        {/* Tab Content - Same structure for all tabs */}
        {["Policy", "Standard", "Procedure"].map((docType) => (
          <TabsContent key={docType} value={docType} className="mt-4 space-y-4">
            {/* Search, Filter, and Action Buttons Row */}
            <div className="flex items-center gap-3">
              <Input
                placeholder={`Search by ${docType.toLowerCase()} name or code...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="max-w-md bg-white"
              />
              <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder="Integrated Framework" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                  <SelectItem value="all">Integrated Framework</SelectItem>
                  {frameworks.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <PermissionGate resource="compliance.governance" action="create">
                <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </PermissionGate>
              <PermissionGate resource="compliance.governance" action="delete">
                <Button variant="outline" size="sm" className="text-semantic-error hover:text-semantic-error hover:bg-red-50" onClick={() => setIsDeleteAllDialogOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </PermissionGate>
              {isCustomerAdmin ? (
                <Button size="sm" onClick={() => {
                  setNewPolicy({ ...newPolicy, documentType: activeDocType });
                  setIsCreateDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Governance
                </Button>
              ) : (
                <PermissionGate resource="compliance.governance" action="create">
                  <Button size="sm" onClick={() => {
                    setNewPolicy({ ...newPolicy, documentType: activeDocType });
                    setIsCreateDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Governance
                  </Button>
                </PermissionGate>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="relative h-8 w-8">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/50">
                        <TableHead className="text-xs font-semibold text-slate-600 py-3 pl-4">Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Assignee</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Approver</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Department Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {policies.map((policy) => (
                        <TableRow
                          key={policy.id}
                          className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50"
                          onDoubleClick={() => router.push(`/compliance/governance/${policy.id}`)}
                        >
                          <TableCell className="py-3 pl-4 text-sm font-medium text-slate-900">{policy.code}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{policy.name}</TableCell>
                          <TableCell className="py-3">
                            <Badge className={getStatusBadgeColor(policy.status)}>
                              {policy.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{policy.assignee?.fullName || "-"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{policy.approver?.fullName || "-"}</TableCell>
                          <TableCell className="py-3 text-sm text-slate-700">{policy.department?.name || "-"}</TableCell>
                          <TableCell className="py-3">
                            <div className="flex gap-1">
                              <PermissionGate resource="compliance.governance" action="edit">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-slate-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/compliance/governance/${policy.id}`);
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
                      ))}
                      {policies.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                            No {docType.toLowerCase()}s found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <p className="text-sm text-slate-500">
                      {total > 0 ? `Showing ${startItem} to ${endItem} of ${total}` : `No ${docType.toLowerCase()}s`}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(1)}
                        className="h-8 w-8"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-slate-600 px-2">
                        Page {currentPage} of {totalPages || 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="h-8 w-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className="h-8 w-8"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Dialog - 3 Steps */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        if (!open) resetCreateDialog();
        setIsCreateDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">New Governance - Step {createStep} of 3</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
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
                  <Label className="text-sm font-medium text-slate-700">Governance Name *</Label>
                  <Input
                    value={newPolicy.name}
                    onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                    placeholder="Enter governance name"
                    className="mt-1.5 w-full"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Department *</Label>
                  <Select value={newPolicy.departmentId} onValueChange={(v) => setNewPolicy({ ...newPolicy, departmentId: v, assigneeId: "" })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      {getCustomerScopedDepartments().map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Document Type *</Label>
                  <Select value={newPolicy.documentType} onValueChange={(v) => setNewPolicy({ ...newPolicy, documentType: v })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Recurrence *</Label>
                  <Select value={newPolicy.recurrence} onValueChange={(v) => setNewPolicy({ ...newPolicy, recurrence: v })}>
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Assignee *</Label>
                  <Select
                    value={newPolicy.assigneeId}
                    onValueChange={(v) => setNewPolicy({ ...newPolicy, assigneeId: v })}
                    disabled={!newPolicy.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={
                        !newPolicy.departmentId
                          ? "Select department first"
                          : "Select assignee"
                      } />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                        ))
                      ) : (
                        <div className="py-2 px-2 text-sm text-slate-500 text-center">
                          No department reviewers found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 2: Link Controls */}
            {createStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold text-slate-800">Select Controls to Link</Label>
                  <Badge variant="secondary">{selectedControlIds.length} selected</Badge>
                </div>

                {/* Control Filters */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search controls..."
                      value={controlSearch}
                      onChange={(e) => setControlSearch(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <Select value={controlDomainFilter} onValueChange={setControlDomainFilter}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Domains</SelectItem>
                      {domains.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={controlStatusFilter} onValueChange={setControlStatusFilter}>
                    <SelectTrigger className="w-[180px] bg-white">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Compliant">Compliant</SelectItem>
                      <SelectItem value="Non Compliant">Non Compliant</SelectItem>
                      <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Controls Table */}
                <div className="bg-white rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/50">
                        <TableHead className="w-[50px] py-3 pl-4"></TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Control Code</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Control Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Domain</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 py-3">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredControls.map((control) => (
                        <TableRow key={control.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <TableCell className="py-3 pl-4">
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
                          <TableCell className="py-3">
                            <Badge className={getStatusBadgeColor(control.status)}>
                              {control.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredControls.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                            No controls found
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
              <div className="space-y-6">
                <div className="text-lg font-medium text-slate-800">Review Information</div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-slate-500 text-sm">Governance Name</Label>
                    <p className="font-medium text-slate-900">{newPolicy.name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Document Type</Label>
                    <p className="font-medium text-slate-900">{newPolicy.documentType}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Recurrence</Label>
                    <p className="font-medium text-slate-900">{newPolicy.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Department</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedDepartments().find((d) => d.id === newPolicy.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Assignee</Label>
                    <p className="font-medium text-slate-900">
                      {getCustomerScopedUsers().find((u) => u.id === newPolicy.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Linked Controls</Label>
                    <p className="font-medium text-slate-900">{selectedControlIds.length} controls</p>
                  </div>
                </div>

                {selectedControlIds.length > 0 && (
                  <div>
                    <Label className="text-slate-500 text-sm mb-2 block">Selected Controls:</Label>
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
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button variant="outline" onClick={() => {
              if (createStep > 1) setCreateStep(createStep - 1);
              else {
                resetCreateDialog();
                setIsCreateDialogOpen(false);
              }
            }}>
              {createStep === 1 ? "Cancel" : "Previous"}
            </Button>
            <Button
              onClick={() => {
                if (createStep < 3) setCreateStep(createStep + 1);
                else handleCreatePolicy();
              }}
              disabled={createStep === 1 && !canProceedStep1}
            >
              {createStep === 3 ? `Create ${newPolicy.documentType}` : "Next"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Policy Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {policyToDelete?.documentType || "Policy"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{policyToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPolicyToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePolicy} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog */}
      <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All {activeDocType}s</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {activeDocType.toLowerCase()}s? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0">
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                Import {activeDocType}s
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <p className="text-sm text-slate-500 mb-4">
              Upload a CSV or Excel file to import {activeDocType.toLowerCase()}s.
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
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300" />
                  <div>
                    <p className="text-sm text-slate-600">
                      Drag and drop a file here, or click to browse
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Supported formats: CSV, XLSX, XLS
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
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" onClick={() => {
              setIsImportDialogOpen(false);
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile}>
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
