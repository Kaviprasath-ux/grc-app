"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions, useHasRole } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  AlertTriangle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Home,
  Search,
} from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { isValidName } from "@/lib/validations";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  name?: string;
  fullName?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  email: string | null;
  departmentId?: string;
  userRoles?: Array<{
    role: {
      name: string;
    };
  }>;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
}

interface Policy {
  id: string;
  code: string;
  name: string;
}

interface Risk {
  id: string;
  riskId: string;
  name: string;
}

interface Framework {
  id: string;
  code: string | null;
  name: string;
}

interface Requirement {
  id: string;
  code: string;
  name: string;
  frameworkId: string;
}

interface Exception {
  id: string;
  exceptionCode: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  endDate: string | null;
  department?: Department | null;
  control?: { id: string; controlCode: string; name: string } | null;
  policy?: { id: string; code: string; name: string } | null;
  risk?: { id: string; riskId: string; name: string } | null;
  framework?: { id: string; code: string | null; name: string } | null;
  requirement?: { id: string; code: string; name: string } | null;
  requester?: User | null;
  approver?: User | null;
}

const statusColors: Record<string, string> = {
  Pending: "bg-warning-light text-warning-dark",
  Approved: "bg-success-light text-success-dark",
  Authorised: "bg-info-light text-info-dark",
  "Submitted for Closure": "bg-primary-100 text-primary-700",
  Overdue: "bg-error-light text-error-dark",
  RiskAccepted: "bg-risk-medium-bg text-risk-medium",
  Closed: "bg-slate-100 text-slate-600",
};

const categoryColors: Record<string, string> = {
  Policy: "bg-primary-100 text-primary-700",
  Control: "bg-info-light text-info-dark",
  Compliance: "bg-success-light text-success-dark",
  Risk: "bg-risk-high-bg text-risk-high",
};

const categories = ["Policy", "Control", "Compliance", "Risk"];
const statuses = [
  "Pending",
  "Approved",
  "Authorised",
  "Submitted for Closure",
  "Overdue",
  "RiskAccepted",
  "Closed",
];

export default function ExceptionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const { data: session } = useSession();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.exceptions');
  const isGRCAdmin = useHasRole("GRCAdministrator");
  const { t } = useLanguage();
  const { toast } = useToast();
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approverDialogOpen, setApproverDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);
  const [saving, setSaving] = useState(false);

  // Current user from session
  const currentUserId = session?.user?.id as string | undefined;
  const currentUserName = session?.user?.name || "Current User";

  // Filters
  const [filters, setFilters] = useState({
    category: "",
    status: "",
  });

  // Reference data
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    category: "",
    departmentId: "",
    controlId: "",
    policyId: "",
    riskId: "",
    frameworkId: "",
    requirementId: "",
    requesterId: "",
    approverId: "",
    endDate: "",
  });

  const [exceptionErrors, setExceptionErrors] = useState<Record<string, string>>({});

  // Edit form
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "",
    status: "",
    departmentId: "",
    controlId: "",
    policyId: "",
    riskId: "",
    frameworkId: "",
    requirementId: "",
    requesterId: "",
    approverId: "",
    endDate: "",
  });

  const fetchExceptions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.append("category", filters.category);
      if (filters.status) params.append("status", filters.status);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/exceptions?${params.toString()}`);
      if (response.ok) {
        const result = await response.json();
        setExceptions(result.data || []);
      }
    } catch (error) {
      console.error("Error fetching exceptions:", error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchTerm]);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [usersRes, deptRes, controlsRes, policiesRes, risksRes, frameworksRes] =
        await Promise.all([
          fetch("/api/users"),
          fetch("/api/departments"),
          fetch("/api/controls"),
          fetch("/api/policies"),
          fetch("/api/risks"),
          fetch("/api/frameworks?status=Subscribed"),
        ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || data || []);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.data || data || []);
      }
      if (controlsRes.ok) {
        const data = await controlsRes.json();
        setControls(data.data || data || []);
      }
      if (policiesRes.ok) {
        const data = await policiesRes.json();
        setPolicies(data.data || data || []);
      }
      if (risksRes.ok) {
        const data = await risksRes.json();
        setRisks(data.data || data || []);
      }
      if (frameworksRes.ok) {
        const data = await frameworksRes.json();
        setFrameworks(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchExceptions();
    fetchReferenceData();
  }, [fetchExceptions, fetchReferenceData]);

  // Fetch requirements when framework is selected
  const fetchRequirements = useCallback(async (frameworkId: string) => {
    if (!frameworkId) {
      setRequirements([]);
      return;
    }
    try {
      const response = await fetch(`/api/requirements?frameworkId=${frameworkId}`);
      if (response.ok) {
        const data = await response.json();
        setRequirements(data.data || data || []);
      }
    } catch (error) {
      console.error("Error fetching requirements:", error);
    }
  }, []);

  // Effect to fetch requirements when create form frameworkId changes
  useEffect(() => {
    if (createForm.frameworkId) {
      fetchRequirements(createForm.frameworkId);
    } else {
      setRequirements([]);
    }
  }, [createForm.frameworkId, fetchRequirements]);

  // Effect to fetch requirements when edit form frameworkId changes
  useEffect(() => {
    if (editForm.frameworkId) {
      fetchRequirements(editForm.frameworkId);
    }
  }, [editForm.frameworkId, fetchRequirements]);

  const handleCreate = async () => {
    const errors: Record<string, string> = {};
    if (!createForm.name.trim()) errors.name = t("Please enter the exception name");
    else if (!isValidName(createForm.name.trim())) errors.name = t("Only letters, spaces, and hyphens are allowed");
    if (!createForm.category) errors.category = t("Please select a category");
    if (!createForm.description.trim()) errors.description = t("Please enter the reason for exception");
    if (!createForm.endDate) errors.endDate = t("Please select the enddate");
    if (Object.keys(errors).length > 0) {
      setExceptionErrors(errors);
      return;
    }
    setExceptionErrors({});
    setSaving(true);
    try {
      const response = await fetch("/api/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          description: createForm.description,
          category: createForm.category,
          departmentId: createForm.departmentId || null,
          controlId:
            createForm.category === "Control" ? createForm.controlId : null,
          policyId:
            createForm.category === "Policy" ? createForm.policyId : null,
          riskId: createForm.category === "Risk" ? createForm.riskId : null,
          frameworkId:
            createForm.category === "Compliance" ? createForm.frameworkId : null,
          requirementId:
            createForm.category === "Compliance" ? createForm.requirementId : null,
          requesterId: currentUserId || null, // Always use current user
          approverId: createForm.approverId || null,
          endDate: createForm.endDate || null,
          status: "Pending",
        }),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Exception created successfully"),
        });
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchExceptions();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to create exception"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating exception:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create exception. Please try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      description: "",
      category: "",
      departmentId: "",
      controlId: "",
      policyId: "",
      riskId: "",
      frameworkId: "",
      requirementId: "",
      requesterId: "",
      approverId: "",
      endDate: "",
    });
    setExceptionErrors({});
  };

  const handleSelectApprover = (user: User) => {
    if (editDialogOpen) {
      setEditForm({ ...editForm, approverId: user.id });
    } else {
      setCreateForm({ ...createForm, approverId: user.id });
    }
    setApproverDialogOpen(false);
  };

  const handleOpenEdit = (exception: Exception, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedException(exception);
    setEditForm({
      name: exception.name,
      description: exception.description || "",
      category: exception.category,
      status: exception.status,
      departmentId: exception.department?.id || "",
      controlId: exception.control?.id || "",
      policyId: exception.policy?.id || "",
      riskId: exception.risk?.id || "",
      frameworkId: exception.framework?.id || "",
      requirementId: exception.requirement?.id || "",
      requesterId: exception.requester?.id || "",
      approverId: exception.approver?.id || "",
      endDate: exception.endDate ? exception.endDate.split("T")[0] : "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedException) return;
    const errors: Record<string, string> = {};
    if (!editForm.name.trim()) errors.name = t("Please enter the exception name");
    else if (!isValidName(editForm.name.trim())) errors.name = t("Only letters, spaces, and hyphens are allowed");
    if (Object.keys(errors).length > 0) {
      setExceptionErrors(errors);
      return;
    }
    setExceptionErrors({});
    setSaving(true);
    try {
      const response = await fetch(`/api/exceptions/${selectedException.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          category: editForm.category,
          status: editForm.status,
          departmentId: editForm.departmentId || null,
          controlId: editForm.category === "Control" ? editForm.controlId : null,
          policyId: editForm.category === "Policy" ? editForm.policyId : null,
          riskId: editForm.category === "Risk" ? editForm.riskId : null,
          frameworkId: editForm.category === "Compliance" ? editForm.frameworkId : null,
          requirementId: editForm.category === "Compliance" ? editForm.requirementId : null,
          requesterId: editForm.requesterId || null,
          approverId: editForm.approverId || null,
          endDate: editForm.endDate || null,
        }),
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Exception updated successfully"),
        });
        setEditDialogOpen(false);
        setSelectedException(null);
        fetchExceptions();
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: t("Error"),
          description: errorData.error || t("Failed to update exception"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating exception:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update exception. Please try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (exception: Exception, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedException(exception);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedException) return;
    try {
      const response = await fetch(`/api/exceptions/${selectedException.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedException(null);
        fetchExceptions();
      }
    } catch (error) {
      console.error("Error deleting exception:", error);
    }
  };

  // Get reference display based on category
  const getReference = (exception: Exception) => {
    if (exception.category === "Control" && exception.control) {
      return exception.control.controlCode;
    }
    if (exception.category === "Policy" && exception.policy) {
      return exception.policy.code;
    }
    if (exception.category === "Risk" && exception.risk) {
      return exception.risk.riskId;
    }
    if (exception.category === "Compliance" && exception.requirement) {
      return exception.requirement.code;
    }
    if (exception.category === "Compliance" && exception.framework) {
      return exception.framework.code || exception.framework.name;
    }
    return "-";
  };

  // Status counts
  const statusCounts = {
    total: exceptions.length,
    pending: exceptions.filter((e) => e.status === "Pending").length,
    approved: exceptions.filter((e) => e.status === "Approved").length,
    authorised: exceptions.filter((e) => e.status === "Authorised").length,
    overdue: exceptions.filter((e) => e.status === "Overdue").length,
    closed: exceptions.filter((e) => e.status === "Closed").length,
  };

  // Category counts
  const categoryCounts = exceptions.reduce(
    (acc, exc) => {
      const cat = exc.category || "Other";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Department counts
  const departmentCounts = exceptions.reduce(
    (acc, exc) => {
      const deptName = exc.department?.name || "Unassigned";
      acc[deptName] = (acc[deptName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Show loading state while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description={t("You don't have permission to access Exception Management.")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        {isGRCAdmin ? (
          <>
            <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
              <Home className="h-4 w-4" />
              <span>{t("GRC")}</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
            <span className="text-slate-500">{t("Compliance")}</span>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 ">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </div>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Exceptions")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Exceptions")}</h1>
      </div>

      {/* Create Exception Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) { setExceptionErrors({}); } setCreateDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("New Exception")}</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Exception Code")}</Label>
                  <Input
                    value={t("Auto-generated")}
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Exception Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, name: e.target.value });
                      if (exceptionErrors.name) {
                        setExceptionErrors((prev) => { const { name, ...rest } = prev; return rest; });
                      }
                    }}
                    placeholder={t("Enter exception name")}
                    className={`mt-1.5 w-full bg-white ${exceptionErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {exceptionErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{exceptionErrors.name}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Requested By")}</Label>
                  <Input
                    value={currentUserName}
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Category")} <span className="text-red-500">*</span></Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(value) => {
                      setCreateForm({
                        ...createForm,
                        category: value,
                        controlId: "",
                        policyId: "",
                        riskId: "",
                        frameworkId: "",
                        requirementId: "",
                      });
                      if (exceptionErrors.category) {
                        setExceptionErrors((prev) => { const { category, ...rest } = prev; return rest; });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${exceptionErrors.category ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {exceptionErrors.category && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{exceptionErrors.category}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Category-specific reference selection */}
              {createForm.category === "Control" && (
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Control")}</Label>
                  <Select
                    value={createForm.controlId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, controlId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select control")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {controls.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.controlCode} – {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {createForm.category === "Policy" && (
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Policy")}</Label>
                  <Select
                    value={createForm.policyId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, policyId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select policy")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {policies.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {createForm.category === "Risk" && (
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Risk")}</Label>
                  <Select
                    value={createForm.riskId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, riskId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select risk")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {risks.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.riskId} – {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {createForm.category === "Compliance" && (
                <>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Integrated Framework")} *</Label>
                    <Select
                      value={createForm.frameworkId}
                      onValueChange={(value) =>
                        setCreateForm({ ...createForm, frameworkId: value, requirementId: "" })
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full bg-white">
                        <SelectValue placeholder={t("Select framework")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {frameworks.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.code ? `${f.code} – ${f.name}` : f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {createForm.frameworkId && (
                    <div>
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Requirement")} *</Label>
                      <Select
                        value={createForm.requirementId}
                        onValueChange={(value) =>
                          setCreateForm({ ...createForm, requirementId: value })
                        }
                      >
                        <SelectTrigger className="mt-1.5 w-full bg-white">
                          <SelectValue placeholder={t("Select requirement")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {requirements.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.code} – {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Reason For Exception")}</Label>
                <Textarea
                  value={createForm.description}
                  onChange={(e) => {
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    });
                    if (exceptionErrors.description) {
                      setExceptionErrors((prev) => { const { description, ...rest } = prev; return rest; });
                    }
                  }}
                  placeholder={t("Enter reason for exception")}
                  rows={3}
                  className={`mt-1.5 w-full bg-white ${exceptionErrors.description ? "border-red-500 focus:ring-red-500" : ""}`}
                />
                {exceptionErrors.description && (
                  <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-600">{exceptionErrors.description}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")} <span className="text-red-500">*</span></Label>
                  <Select
                    value={createForm.departmentId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, departmentId: value, approverId: "" })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Approver")} <span className="text-red-500">*</span></Label>
                  <Select
                    value={createForm.approverId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, approverId: value })
                    }
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={createForm.departmentId ? t("Select approver") : t("Select department first")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users
                        .filter((u) =>
                          u.departmentId === createForm.departmentId &&
                          u.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")
                        )
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName || u.name}
                          </SelectItem>
                        ))}
                      {users.filter((u) =>
                        u.departmentId === createForm.departmentId &&
                        u.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")
                      ).length === 0 && createForm.departmentId && (
                        <div className="px-2 py-1.5 text-sm text-slate-500">
                          {t("No department reviewers found")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</Label>
                  <Input value={t("Pending")} disabled className="mt-1.5 w-full bg-slate-50" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("End Date")} <span className="text-red-500">*</span></Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={createForm.endDate}
                      onChange={(date) => {
                        setCreateForm({
                          ...createForm,
                          endDate: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "",
                        });
                        if (exceptionErrors.endDate) {
                          setExceptionErrors((prev) => { const { endDate, ...rest } = prev; return rest; });
                        }
                      }}
                      placeholder={t("Select end date")}
                      className="w-full bg-white"
                    />
                  </div>
                  {exceptionErrors.endDate && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{exceptionErrors.endDate}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex flex-row items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setExceptionErrors({});
                setCreateDialogOpen(false);
                resetCreateForm();
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approver Selection Dialog */}
      <Dialog open={approverDialogOpen} onOpenChange={setApproverDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Select Approver")}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b border-slate-100">
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Name")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Email")}</TableHead>
                    <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <TableCell className="py-3 pl-5 text-sm text-slate-700">{user.fullName || user.userName || user.name || "-"}</TableCell>
                      <TableCell className="py-3 text-sm text-slate-700">{user.email || "-"}</TableCell>
                      <TableCell className="py-3 pr-5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectApprover(user)}
                          className="h-7 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50"
                        >
                          {t("Select")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Charts Row with Pie Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Status Pie Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-500 mb-2">{t("Status")}</h3>
          <div className="h-[200px]">
            {statusCounts.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: t("Pending"), value: statusCounts.pending, color: "#f59e0b" },
                      { name: t("Approved"), value: statusCounts.approved, color: "#22c55e" },
                      { name: t("Authorised"), value: statusCounts.authorised, color: "#3b82f6" },
                      { name: t("Overdue"), value: statusCounts.overdue, color: "#ef4444" },
                      { name: t("Closed"), value: statusCounts.closed, color: "#64748b" },
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {[
                      { name: t("Pending"), value: statusCounts.pending, color: "#f59e0b" },
                      { name: t("Approved"), value: statusCounts.approved, color: "#22c55e" },
                      { name: t("Authorised"), value: statusCounts.authorised, color: "#3b82f6" },
                      { name: t("Overdue"), value: statusCounts.overdue, color: "#ef4444" },
                      { name: t("Closed"), value: statusCounts.closed, color: "#64748b" },
                    ].filter(item => item.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="text-xs text-slate-600">
                            {data.name}: {data.value}
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
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                {t("No data")}
              </div>
            )}
          </div>
        </div>

        {/* Type/Category Pie Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-500 mb-2">{t("Type")}</h3>
          <div className="h-[200px]">
            {statusCounts.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(categoryCounts).map(([name, value], idx) => ({
                      name,
                      value,
                      color: ["#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"][idx % 5]
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {Object.entries(categoryCounts).map(([, ], idx) => (
                      <Cell key={`cell-${idx}`} fill={["#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"][idx % 5]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="text-xs text-slate-600">
                            {data.name}: {data.value}
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
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                {t("No data")}
              </div>
            )}
          </div>
        </div>

        {/* Department Pie Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-500 mb-2">{t("Department")}</h3>
          <div className="h-[200px]">
            {statusCounts.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(departmentCounts).map(([name, value], idx) => ({
                      name,
                      value,
                      color: ["#3b82f6", "#22c55e", "#f59e0b", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899"][idx % 7]
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {Object.entries(departmentCounts).map(([, ], idx) => (
                      <Cell key={`cell-${idx}`} fill={["#3b82f6", "#22c55e", "#f59e0b", "#6366f1", "#ef4444", "#8b5cf6", "#ec4899"][idx % 7]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="text-xs text-slate-600">
                            {data.name}: {data.value}
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
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                {t("No data")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex sm:justify-end">
        <PermissionGate resource="compliance.exceptions" action="create">
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("New Exception")}
          </Button>
        </PermissionGate>
      </div>

      {/* Exceptions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Search & Filters Toolbar */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search by name, code or requester...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto ltr:sm:ml-auto rtl:sm:mr-auto">
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("All Statuses")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Statuses")}</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, category: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                  <SelectValue placeholder={t("All Categories")} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">{t("All Categories")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-100">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Exception Code")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Exception")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Category")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Reference")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Requester")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("End Date")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-primary-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t("No exceptions found")}</p>
                        <p className="text-xs text-slate-500 mt-1">{t("Create a new exception to get started")}</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                exceptions.map((exception) => (
                  <TableRow
                    key={exception.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                  >
                    <TableCell className="py-3 pl-5 text-sm font-medium text-slate-800">
                      {exception.exceptionCode}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      <span className="line-clamp-1">{exception.name}</span>
                    </TableCell>
                    <TableCell className="py-3 text-sm">
                      <Badge
                        className={
                          categoryColors[exception.category] || "bg-slate-100 text-slate-600"
                        }
                      >
                        {exception.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{getReference(exception)}</TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      {exception.requester?.fullName ||
                        exception.requester?.userName ||
                        exception.requester?.name ||
                        "-"}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">
                      {exception.endDate
                        ? new Date(exception.endDate).toLocaleDateString(
                            "en-GB"
                          )
                        : "-"}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-slate-700">{exception.department?.name || "-"}</TableCell>
                    <TableCell className="py-3 text-sm">
                      <Badge
                        className={
                          statusColors[exception.status] || "bg-slate-100 text-slate-600"
                        }
                      >
                        {exception.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 pr-5 text-sm">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => router.push(`/compliance/exceptions/${exception.id}`)}
                          title={t("View")}
                          className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <PermissionGate resource="compliance.exceptions" action="edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleOpenEdit(exception, e)}
                            title={t("Edit")}
                            className="h-7 w-7 text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate resource="compliance.exceptions" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleOpenDelete(exception, e)}
                            title={t("Delete")}
                            className="h-7 w-7 text-slate-400 hover:text-semantic-error hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {exceptions.length > 0 ? `${t("Showing")} 1 ${t("to")} ${exceptions.length} ${t("of")} ${exceptions.length}` : t("No exceptions")}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={true}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={true}
                className="h-7 w-7 text-slate-400 hover:text-slate-600"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Exception Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) { setExceptionErrors({}); } setEditDialogOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Exception")}</DialogTitle>
              {selectedException?.status === "Approved" && (
                <p className="text-sm text-green-600 mt-1">
                  {t("This exception has been approved and cannot be edited.")}
                </p>
              )}
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Exception Code")}</Label>
                  <Input
                    value={selectedException?.exceptionCode || ""}
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Exception Name")} *</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => {
                      setEditForm({ ...editForm, name: e.target.value });
                      if (exceptionErrors.name) {
                        setExceptionErrors((prev) => { const { name, ...rest } = prev; return rest; });
                      }
                    }}
                    placeholder={t("Enter exception name")}
                    disabled={selectedException?.status === "Approved"}
                    className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"} ${exceptionErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {exceptionErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{exceptionErrors.name}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Requested By")}</Label>
                  <Select
                    value={editForm.requesterId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, requesterId: value })
                    }
                    disabled={selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={t("Select requester")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName || u.userName || u.name || "-"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Category")} *</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) =>
                      setEditForm({
                        ...editForm,
                        category: value,
                        controlId: "",
                        policyId: "",
                        riskId: "",
                        frameworkId: "",
                        requirementId: "",
                      })
                    }
                    disabled={selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={t("Select category")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Category-specific reference selection */}
              {editForm.category === "Control" && (
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Control")}</Label>
                  <Select
                    value={editForm.controlId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, controlId: value })
                    }
                    disabled={selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={t("Select control")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {controls.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.controlCode} – {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editForm.category === "Policy" && (
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Policy")}</Label>
                  <Select
                    value={editForm.policyId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, policyId: value })
                    }
                    disabled={selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={t("Select policy")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {policies.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editForm.category === "Risk" && (
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Risk")}</Label>
                  <Select
                    value={editForm.riskId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, riskId: value })
                    }
                    disabled={selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={t("Select risk")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {risks.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.riskId} – {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editForm.category === "Compliance" && (
                <>
                  <div>
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Integrated Framework")} *</Label>
                    <Select
                      value={editForm.frameworkId}
                      onValueChange={(value) =>
                        setEditForm({ ...editForm, frameworkId: value, requirementId: "" })
                      }
                      disabled={selectedException?.status === "Approved"}
                    >
                      <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                        <SelectValue placeholder={t("Select framework")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {frameworks.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.code ? `${f.code} – ${f.name}` : f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {editForm.frameworkId && (
                    <div>
                      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Requirement")} *</Label>
                      <Select
                        value={editForm.requirementId}
                        onValueChange={(value) =>
                          setEditForm({ ...editForm, requirementId: value })
                        }
                        disabled={selectedException?.status === "Approved"}
                      >
                        <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                          <SelectValue placeholder={t("Select requirement")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {requirements.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.code} – {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Reason For Exception")}</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      description: e.target.value,
                    })
                  }
                  placeholder={t("Enter reason for exception")}
                  rows={3}
                  disabled={selectedException?.status === "Approved"}
                  className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Department")}</Label>
                  <Select
                    value={editForm.departmentId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, departmentId: value, approverId: "" })
                    }
                    disabled={selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Select Approver")}</Label>
                  <Select
                    value={editForm.approverId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, approverId: value })
                    }
                    disabled={!editForm.departmentId || selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={editForm.departmentId ? t("Select approver") : t("Select department first")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {users
                        .filter((u) =>
                          u.departmentId === editForm.departmentId &&
                          u.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")
                        )
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName || u.name}
                          </SelectItem>
                        ))}
                      {users.filter((u) =>
                        u.departmentId === editForm.departmentId &&
                        u.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")
                      ).length === 0 && editForm.departmentId && (
                        <div className="px-2 py-1.5 text-sm text-slate-500">
                          {t("No department reviewers found")}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("Status")}</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, status: value })
                    }
                    disabled={selectedException?.status === "Approved"}
                  >
                    <SelectTrigger className={`mt-1.5 w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}>
                      <SelectValue placeholder={t("Select status")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t("End Date")}</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={editForm.endDate}
                      onChange={(date) =>
                        setEditForm({
                          ...editForm,
                          endDate: date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "",
                        })
                      }
                      placeholder={t("Select end date")}
                      disabled={selectedException?.status === "Approved"}
                      className={`w-full ${selectedException?.status === "Approved" ? "bg-slate-50" : "bg-white"}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex flex-row items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setExceptionErrors({});
                setEditDialogOpen(false);
                setSelectedException(null);
              }}
            >
              {selectedException?.status === "Approved" ? t("Close") : t("Cancel")}
            </Button>
            {selectedException?.status !== "Approved" && (
              <Button
                className="w-full sm:w-auto"
                onClick={handleEdit}
                disabled={!editForm.name || !editForm.category || saving}
              >
                {saving ? t("Saving...") : t("Save")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-100">
            <AlertDialogTitle className="text-base font-semibold text-slate-800">{t("Delete Exception")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500">
              {t("Are you sure you want to delete exception")} &quot;{selectedException?.exceptionCode} - {selectedException?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel onClick={() => setSelectedException(null)}>
              {t("Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
