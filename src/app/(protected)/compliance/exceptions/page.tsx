"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
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
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
} from "lucide-react";
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
  controlId: string;
  name: string;
}

interface Policy {
  id: string;
  code: string;
  name: string;
}

interface Risk {
  id: string;
  riskCode: string;
  name: string;
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
  control?: { id: string; controlId: string; name: string } | null;
  policy?: { id: string; code: string; name: string } | null;
  risk?: { id: string; riskCode: string; name: string } | null;
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

function ExceptionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromDashboard = searchParams.get("from") === "dashboard";
  const { data: session } = useSession();
  const { canView, canCreate, canEdit, canDelete, isLoading: permissionsLoading } = usePermissions('compliance.exceptions');
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approverDialogOpen, setApproverDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);

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

  // Create form
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    category: "",
    departmentId: "",
    controlId: "",
    policyId: "",
    riskId: "",
    requesterId: "",
    approverId: "",
    endDate: "",
  });

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
      const [usersRes, deptRes, controlsRes, policiesRes, risksRes] =
        await Promise.all([
          fetch("/api/users"),
          fetch("/api/departments"),
          fetch("/api/controls"),
          fetch("/api/policies"),
          fetch("/api/risks"),
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
    } catch (error) {
      console.error("Error fetching reference data:", error);
    }
  }, []);

  useEffect(() => {
    fetchExceptions();
    fetchReferenceData();
  }, [fetchExceptions, fetchReferenceData]);

  const handleCreate = async () => {
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
          requesterId: currentUserId || null, // Always use current user
          approverId: createForm.approverId || null,
          endDate: createForm.endDate || null,
          status: "Pending",
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchExceptions();
      }
    } catch (error) {
      console.error("Error creating exception:", error);
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
      requesterId: "",
      approverId: "",
      endDate: "",
    });
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
      requesterId: exception.requester?.id || "",
      approverId: exception.approver?.id || "",
      endDate: exception.endDate ? exception.endDate.split("T")[0] : "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedException) return;
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
          requesterId: editForm.requesterId || null,
          approverId: editForm.approverId || null,
          endDate: editForm.endDate || null,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedException(null);
        fetchExceptions();
      }
    } catch (error) {
      console.error("Error updating exception:", error);
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
      return exception.control.controlId;
    }
    if (exception.category === "Policy" && exception.policy) {
      return exception.policy.code;
    }
    if (exception.category === "Risk" && exception.risk) {
      return exception.risk.riskCode;
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
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show unauthorized if user doesn't have view permission
  if (!canView) {
    return <Unauthorized description="You don't have permission to access Exception Management." />;
  }

  return (
    <div className="space-y-6">
      {/* Back to Dashboard Button */}
      {fromDashboard && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Exceptions</h1>
      </div>

      {/* Search, Filter, and Action Buttons Row */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name, code or requester..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md bg-white"
        />
        <Select
          value={filters.status || "all"}
          onValueChange={(value) =>
            setFilters({ ...filters, status: value === "all" ? "" : value })
          }
        >
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Statuses</SelectItem>
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
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <PermissionGate resource="compliance.exceptions" action="create">
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Exception
          </Button>
        </PermissionGate>
      </div>

      {/* Create Exception Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">New Exception</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Exception Code</Label>
                  <Input
                    value="Auto-generated"
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Exception Name *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="Enter exception name"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Requested By</Label>
                  <Input
                    value={currentUserName}
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Category *</Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(value) =>
                      setCreateForm({
                        ...createForm,
                        category: value,
                        controlId: "",
                        policyId: "",
                        riskId: "",
                      })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select category" />
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
              {createForm.category === "Control" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Select Control</Label>
                  <Select
                    value={createForm.controlId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, controlId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select control" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {controls.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.controlId} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {createForm.category === "Policy" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Select Policy</Label>
                  <Select
                    value={createForm.policyId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, policyId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select policy" />
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
                  <Label className="text-sm font-medium text-slate-700">Select Risk</Label>
                  <Select
                    value={createForm.riskId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, riskId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {risks.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.riskCode} - {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">Reason For Exception</Label>
                <Textarea
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Enter reason for exception"
                  rows={3}
                  className="mt-1.5 w-full bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Department</Label>
                  <Select
                    value={createForm.departmentId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, departmentId: value, approverId: "" })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select department" />
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
                  <Label className="text-sm font-medium text-slate-700">Select Approver</Label>
                  <Select
                    value={createForm.approverId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, approverId: value })
                    }
                    disabled={!createForm.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={createForm.departmentId ? "Select approver" : "Select department first"} />
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
                          No department reviewers found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Status</Label>
                  <Input value="Pending" disabled className="mt-1.5 w-full bg-slate-50" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">End Date</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={createForm.endDate}
                      onChange={(date) =>
                        setCreateForm({
                          ...createForm,
                          endDate: date ? date.toISOString().split("T")[0] : "",
                        })
                      }
                      placeholder="Select end date"
                      className="w-full bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!createForm.name || !createForm.category}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approver Selection Dialog */}
      <Dialog open={approverDialogOpen} onOpenChange={setApproverDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Select Approver</DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5">
            <p className="text-sm text-slate-500 mb-4">
              Double-click to select an approver
            </p>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="text-xs font-semibold text-slate-600 py-3">Name</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-600 py-3">Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onDoubleClick={() => handleSelectApprover(user)}
                    >
                      <TableCell className="text-slate-600">{user.fullName || user.userName || user.name || "-"}</TableCell>
                      <TableCell className="text-slate-600">{user.email || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Status Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Status</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-warning" />
                <span className="text-sm text-slate-600">Pending</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {statusCounts.pending}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-success" />
                <span className="text-sm text-slate-600">Approved</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {statusCounts.approved}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-info" />
                <span className="text-sm text-slate-600">Authorised</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {statusCounts.authorised}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-error" />
                <span className="text-sm text-slate-600">Overdue</span>
                <span className="text-sm font-medium text-slate-800 ml-auto">
                  {statusCounts.overdue}
                </span>
              </div>
            </div>
            <div className="text-center ml-8">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-3xl font-bold text-slate-800">{statusCounts.total}</p>
            </div>
          </div>
        </div>

        {/* Type/Category Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Type</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              {Object.entries(categoryCounts)
                .slice(0, 4)
                .map(([cat, count], idx) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full ${
                        idx === 0
                          ? "bg-primary-500"
                          : idx === 1
                            ? "bg-info"
                            : idx === 2
                              ? "bg-success"
                              : "bg-risk-high"
                      }`}
                    />
                    <span className="text-sm text-slate-600">{cat}</span>
                    <span className="text-sm font-medium text-slate-800 ml-auto">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
            <div className="text-center ml-8">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-3xl font-bold text-slate-800">{statusCounts.total}</p>
            </div>
          </div>
        </div>

        {/* Department Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Department</h3>
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              {Object.entries(departmentCounts)
                .slice(0, 4)
                .map(([dept, count], idx) => (
                  <div key={dept} className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full ${
                        idx === 0
                          ? "bg-info"
                          : idx === 1
                            ? "bg-success"
                            : idx === 2
                              ? "bg-warning"
                              : "bg-primary-500"
                      }`}
                    />
                    <span className="text-sm text-slate-600 truncate max-w-[100px]">
                      {dept}
                    </span>
                    <span className="text-sm font-medium text-slate-800 ml-auto">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
            <div className="text-center ml-8">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-3xl font-bold text-slate-800">{statusCounts.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exceptions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Exception Code</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Exception</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Category</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Reference</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Requester</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">End Date</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Department</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p className="text-slate-500">No exceptions found</p>
                  </TableCell>
                </TableRow>
              ) : (
                exceptions.map((exception) => (
                  <TableRow
                    key={exception.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => router.push(`/compliance/exceptions/${exception.id}`)}
                  >
                    <TableCell className="font-medium text-slate-900">
                      {exception.exceptionCode}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <span className="line-clamp-1">{exception.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          categoryColors[exception.category] || "bg-slate-100 text-slate-600"
                        }
                      >
                        {exception.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{getReference(exception)}</TableCell>
                    <TableCell className="text-slate-600">
                      {exception.requester?.fullName ||
                        exception.requester?.userName ||
                        exception.requester?.name ||
                        "-"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {exception.endDate
                        ? new Date(exception.endDate).toLocaleDateString(
                            "en-GB"
                          )
                        : "-"}
                    </TableCell>
                    <TableCell className="text-slate-600">{exception.department?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          statusColors[exception.status] || "bg-slate-100 text-slate-600"
                        }
                      >
                        {exception.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <PermissionGate resource="compliance.exceptions" action="edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleOpenEdit(exception, e)}
                            title="Edit"
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate resource="compliance.exceptions" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleOpenDelete(exception, e)}
                            title="Delete"
                            className="h-8 w-8 text-semantic-error hover:text-semantic-error hover:bg-red-50"
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

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              {exceptions.length > 0 ? `Showing 1 to ${exceptions.length} of ${exceptions.length}` : "No exceptions"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={true}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={true}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={true}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={true}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Exception Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Sticky Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">Edit Exception</DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-6 py-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Exception Code</Label>
                  <Input
                    value={selectedException?.exceptionCode || ""}
                    disabled
                    className="mt-1.5 w-full bg-slate-50"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">Exception Name *</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    placeholder="Enter exception name"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Requested By</Label>
                  <Select
                    value={editForm.requesterId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, requesterId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select requester" />
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
                  <Label className="text-sm font-medium text-slate-700">Category *</Label>
                  <Select
                    value={editForm.category}
                    onValueChange={(value) =>
                      setEditForm({
                        ...editForm,
                        category: value,
                        controlId: "",
                        policyId: "",
                        riskId: "",
                      })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select category" />
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
                  <Label className="text-sm font-medium text-slate-700">Select Control</Label>
                  <Select
                    value={editForm.controlId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, controlId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select control" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {controls.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.controlId} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editForm.category === "Policy" && (
                <div>
                  <Label className="text-sm font-medium text-slate-700">Select Policy</Label>
                  <Select
                    value={editForm.policyId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, policyId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select policy" />
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
                  <Label className="text-sm font-medium text-slate-700">Select Risk</Label>
                  <Select
                    value={editForm.riskId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, riskId: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {risks.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.riskCode} - {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">Reason For Exception</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Enter reason for exception"
                  rows={3}
                  className="mt-1.5 w-full bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Department</Label>
                  <Select
                    value={editForm.departmentId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, departmentId: value, approverId: "" })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select department" />
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
                  <Label className="text-sm font-medium text-slate-700">Select Approver</Label>
                  <Select
                    value={editForm.approverId}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, approverId: value })
                    }
                    disabled={!editForm.departmentId}
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder={editForm.departmentId ? "Select approver" : "Select department first"} />
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
                          No department reviewers found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm({ ...editForm, status: value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select status" />
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
                  <Label className="text-sm font-medium text-slate-700">End Date</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={editForm.endDate}
                      onChange={(date) =>
                        setEditForm({
                          ...editForm,
                          endDate: date ? date.toISOString().split("T")[0] : "",
                        })
                      }
                      placeholder="Select end date"
                      className="w-full bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedException(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={!editForm.name || !editForm.category}
            >
              Update
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exception</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete exception &quot;{selectedException?.exceptionCode} - {selectedException?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedException(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ExceptionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
            <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading exceptions...</p>
        </div>
      </div>
    }>
      <ExceptionsPageContent />
    </Suspense>
  );
}
