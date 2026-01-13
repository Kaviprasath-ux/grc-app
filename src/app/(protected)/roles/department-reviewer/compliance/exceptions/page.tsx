"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
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
  Search,
  Plus,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
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
  name: string;
  email: string | null;
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
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-green-100 text-green-800",
  Authorised: "bg-blue-100 text-blue-800",
  "Submitted for Closure": "bg-purple-100 text-purple-800",
  Overdue: "bg-orange-100 text-orange-800",
  RiskAccepted: "bg-pink-100 text-pink-800",
  Closed: "bg-gray-100 text-gray-800",
};

const categoryColors: Record<string, string> = {
  Policy: "bg-purple-100 text-purple-800",
  Control: "bg-blue-100 text-blue-800",
  Compliance: "bg-green-100 text-green-800",
  Risk: "bg-orange-100 text-orange-800",
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
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approverDialogOpen, setApproverDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<Exception | null>(null);

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
          requesterId: createForm.requesterId || null,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exception Dashboard</h1>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Exception
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Exception</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Exception Code</Label>
                  <Input
                    value="Auto-generated"
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Exception Name *</Label>
                  <Input
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="Enter exception name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Requested By</Label>
                  <Select
                    value={createForm.requesterId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, requesterId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select requester" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Category *</Label>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="space-y-2">
                  <Label className="font-medium">Select Control</Label>
                  <Select
                    value={createForm.controlId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, controlId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select control" />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="space-y-2">
                  <Label className="font-medium">Select Policy</Label>
                  <Select
                    value={createForm.policyId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, policyId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select policy" />
                    </SelectTrigger>
                    <SelectContent>
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
                <div className="space-y-2">
                  <Label className="font-medium">Select Risk</Label>
                  <Select
                    value={createForm.riskId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, riskId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                    <SelectContent>
                      {risks.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.riskCode} - {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-medium">Reason For Exception</Label>
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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Department</Label>
                  <Select
                    value={createForm.departmentId}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, departmentId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">Select Approver</Label>
                  <div className="flex gap-2">
                    <Input
                      value={
                        users.find((u) => u.id === createForm.approverId)
                          ?.name || ""
                      }
                      readOnly
                      placeholder="Click to select"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setApproverDialogOpen(true)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-medium">Status</Label>
                  <Input value="Pending" disabled className="bg-gray-100" />
                </div>
                <div className="space-y-2">
                  <Label className="font-medium">End date</Label>
                  <Input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, endDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Approver Selection Dialog */}
        <Dialog open={approverDialogOpen} onOpenChange={setApproverDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Select Approver</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-500 mb-4">
              Double-click to select an approver
            </p>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-gray-100"
                      onDoubleClick={() => handleSelectApprover(user)}
                    >
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Status Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500" />
                  <span className="text-sm">Pending</span>
                  <span className="text-sm font-medium ml-auto">
                    {statusCounts.pending}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-sm">Approved</span>
                  <span className="text-sm font-medium ml-auto">
                    {statusCounts.approved}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500" />
                  <span className="text-sm">Authorised</span>
                  <span className="text-sm font-medium ml-auto">
                    {statusCounts.authorised}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500" />
                  <span className="text-sm">Overdue</span>
                  <span className="text-sm font-medium ml-auto">
                    {statusCounts.overdue}
                  </span>
                </div>
              </div>
              <div className="text-center ml-8">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold">{statusCounts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Type/Category Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                {Object.entries(categoryCounts)
                  .slice(0, 4)
                  .map(([cat, count], idx) => (
                    <div key={cat} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          idx === 0
                            ? "bg-purple-500"
                            : idx === 1
                              ? "bg-blue-500"
                              : idx === 2
                                ? "bg-green-500"
                                : "bg-orange-500"
                        }`}
                      />
                      <span className="text-sm">{cat}</span>
                      <span className="text-sm font-medium ml-auto">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="text-center ml-8">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold">{statusCounts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Chart Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Department</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2 flex-1">
                {Object.entries(departmentCounts)
                  .slice(0, 4)
                  .map(([dept, count], idx) => (
                    <div key={dept} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full ${
                          idx === 0
                            ? "bg-blue-500"
                            : idx === 1
                              ? "bg-green-500"
                              : idx === 2
                                ? "bg-yellow-500"
                                : "bg-purple-500"
                        }`}
                      />
                      <span className="text-sm truncate max-w-[100px]">
                        {dept}
                      </span>
                      <span className="text-sm font-medium ml-auto">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="text-center ml-8">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold">{statusCounts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Status</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Category</Label>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, category: value === "all" ? "" : value })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Exceptions Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exception code</TableHead>
                <TableHead>Exception</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>End date</TableHead>
                <TableHead>Department Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-500">No exceptions found</p>
                  </TableCell>
                </TableRow>
              ) : (
                exceptions.map((exception) => (
                  <TableRow
                    key={exception.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/compliance/exceptions/${exception.id}`)}
                  >
                    <TableCell className="font-medium">
                      {exception.exceptionCode}
                    </TableCell>
                    <TableCell>
                      <span className="line-clamp-1">{exception.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          categoryColors[exception.category] || "bg-gray-100"
                        }
                      >
                        {exception.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{getReference(exception)}</TableCell>
                    <TableCell>{exception.requester?.name || "-"}</TableCell>
                    <TableCell>
                      {exception.endDate
                        ? new Date(exception.endDate).toLocaleDateString(
                            "en-GB"
                          )
                        : "-"}
                    </TableCell>
                    <TableCell>{exception.department?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          statusColors[exception.status] || "bg-gray-100"
                        }
                      >
                        {exception.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleOpenEdit(exception, e)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleOpenDelete(exception, e)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
            <span>
              Currently showing 1 to {exceptions.length} of {exceptions.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Edit Exception Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exception</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Exception Code</Label>
                <Input
                  value={selectedException?.exceptionCode || ""}
                  disabled
                  className="bg-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Exception Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  placeholder="Enter exception name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Requested By</Label>
                <Select
                  value={editForm.requesterId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, requesterId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select requester" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Category *</Label>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
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
              <div className="space-y-2">
                <Label className="font-medium">Select Control</Label>
                <Select
                  value={editForm.controlId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, controlId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select control" />
                  </SelectTrigger>
                  <SelectContent>
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
              <div className="space-y-2">
                <Label className="font-medium">Select Policy</Label>
                <Select
                  value={editForm.policyId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, policyId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
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
              <div className="space-y-2">
                <Label className="font-medium">Select Risk</Label>
                <Select
                  value={editForm.riskId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, riskId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk" />
                  </SelectTrigger>
                  <SelectContent>
                    {risks.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.riskCode} - {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-medium">Reason For Exception</Label>
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
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Department</Label>
                <Select
                  value={editForm.departmentId}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, departmentId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-medium">Select Approver</Label>
                <div className="flex gap-2">
                  <Input
                    value={
                      users.find((u) => u.id === editForm.approverId)?.name || ""
                    }
                    readOnly
                    placeholder="Click to select"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setApproverDialogOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-medium">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-medium">End date</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
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
