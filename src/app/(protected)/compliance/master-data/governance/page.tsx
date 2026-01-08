"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Search } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId: string | null;
}

interface Framework {
  id: string;
  name: string;
  code: string;
}

interface ControlDomain {
  id: string;
  name: string;
  code: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  functionalGrouping: string | null;
  entities: string | null;
  framework?: Framework | null;
  domain?: ControlDomain | null;
}

interface Policy {
  id: string;
  code: string;
  name: string;
  version: string;
  documentType: string;
  recurrence: string | null;
  status: string;
  content: string | null;
  department: Department | null;
  assignee: User | null;
  approver: User | null;
  policyControls?: { control: Control }[];
  _count?: {
    policyControls: number;
    attachments: number;
  };
}

const statusColors: Record<string, string> = {
  "Published": "bg-green-100 text-green-800",
  "Draft": "bg-yellow-100 text-yellow-800",
  "Approved": "bg-blue-100 text-blue-800",
  "Needs Review": "bg-orange-100 text-orange-800",
  "Not Uploaded": "bg-gray-100 text-gray-800",
  "Pending Approval": "bg-purple-100 text-purple-800",
};

const documentTypes = ["Policy", "Standard", "Procedure"];
const recurrenceOptions = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const functionalGroupings = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

export default function GovernanceMasterDataPage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Wizard state for New Policies
  const [wizardStep, setWizardStep] = useState(1);

  // Step 2 filters
  const [controlCategoryFilter, setControlCategoryFilter] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("");
  const [functionalGroupingFilter, setFunctionalGroupingFilter] = useState("");
  const [controlSearchTerm, setControlSearchTerm] = useState("");
  const [selectedControlIds, setSelectedControlIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    documentType: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
    approverId: "",
    content: "",
    status: "Not Uploaded",
  });

  // Get users filtered by selected department
  const filteredUsers = formData.departmentId
    ? users.filter((u) => u.departmentId === formData.departmentId)
    : users;

  // Get filtered controls for Step 2
  const filteredControls = controls.filter((c) => {
    if (controlCategoryFilter && c.domain?.name !== controlCategoryFilter) return false;
    if (frameworkFilter && c.framework?.id !== frameworkFilter) return false;
    if (functionalGroupingFilter && c.functionalGrouping !== functionalGroupingFilter) return false;
    if (controlSearchTerm) {
      const search = controlSearchTerm.toLowerCase();
      if (!c.controlCode.toLowerCase().includes(search) && !c.name.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  // Get unique policy categories (control domains)
  const policyCategories = [...new Set(controls.map(c => c.domain?.name).filter(Boolean))] as string[];

  const fetchPolicies = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setPolicies(data);
          setTotal(data.length);
          setTotalPages(1);
        } else {
          setPolicies(data.data || []);
          setTotal(data.pagination?.total || 0);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      }
    } catch (error) {
      console.error("Error fetching policies:", error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchFrameworks = useCallback(async () => {
    try {
      const response = await fetch("/api/frameworks");
      if (response.ok) {
        const data = await response.json();
        setFrameworks(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching frameworks:", error);
    }
  }, []);

  const fetchControls = useCallback(async () => {
    try {
      const response = await fetch("/api/controls?limit=500");
      if (response.ok) {
        const data = await response.json();
        setControls(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
    fetchDepartments();
    fetchUsers();
    fetchFrameworks();
    fetchControls();
  }, [fetchPolicies, fetchDepartments, fetchUsers, fetchFrameworks, fetchControls]);

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          documentType: formData.documentType || "Policy",
          recurrence: formData.recurrence || null,
          departmentId: formData.departmentId || null,
          assigneeId: formData.assigneeId || null,
          approverId: formData.approverId || null,
          content: formData.content || null,
          status: "Not Uploaded",
          controlIds: Array.from(selectedControlIds),
        }),
      });

      if (response.ok) {
        setCreateDialogOpen(false);
        setWizardStep(1);
        resetForm();
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error creating policy:", error);
    }
  };

  const handleEdit = async () => {
    if (!selectedPolicy) return;
    try {
      const response = await fetch(`/api/policies/${selectedPolicy.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          documentType: formData.documentType || "Policy",
          recurrence: formData.recurrence || null,
          departmentId: formData.departmentId || null,
          assigneeId: formData.assigneeId || null,
          approverId: formData.approverId || null,
          content: formData.content || null,
          status: formData.status,
        }),
      });

      if (response.ok) {
        setEditDialogOpen(false);
        setSelectedPolicy(null);
        resetForm();
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error updating policy:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedPolicy) return;
    try {
      const response = await fetch(`/api/policies/${selectedPolicy.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDeleteDialogOpen(false);
        setSelectedPolicy(null);
        fetchPolicies();
      }
    } catch (error) {
      console.error("Error deleting policy:", error);
    }
  };

  const openEditDialog = (policy: Policy) => {
    setSelectedPolicy(policy);
    setFormData({
      code: policy.code,
      name: policy.name,
      documentType: policy.documentType,
      recurrence: policy.recurrence || "",
      departmentId: policy.department?.id || "",
      assigneeId: policy.assignee?.id || "",
      approverId: policy.approver?.id || "",
      content: policy.content || "",
      status: policy.status,
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (policy: Policy) => {
    setSelectedPolicy(policy);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      documentType: "",
      recurrence: "",
      departmentId: "",
      assigneeId: "",
      approverId: "",
      content: "",
      status: "Not Uploaded",
    });
    setWizardStep(1);
    setSelectedControlIds(new Set());
    setControlCategoryFilter("");
    setFrameworkFilter("");
    setFunctionalGroupingFilter("");
    setControlSearchTerm("");
  };

  const toggleControlSelection = (controlId: string) => {
    setSelectedControlIds((prev) => {
      const next = new Set(prev);
      if (next.has(controlId)) {
        next.delete(controlId);
      } else {
        next.add(controlId);
      }
      return next;
    });
  };

  const handleExport = () => {
    const csv = [
      ["Policy Name", "Status", "Assignee", "Approver", "Department Name", "Policy Requirement", "Recurrence", "Policy Code", "Document Type"],
      ...policies.map((p) => [
        p.name,
        p.status,
        p.assignee?.fullName || "",
        p.approver?.fullName || "",
        p.department?.name || "",
        p.content || "",
        p.recurrence || "",
        p.code,
        p.documentType,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "governance.csv";
    a.click();
  };

  const handleDownloadTemplate = () => {
    const templateCsv = [
      ["Policy Name", "Document Type", "Recurrence", "Department", "Content"],
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([templateCsv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "governance_template.csv";
    a.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((line) => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      let successCount = 0;
      let errorCount = 0;

      for (const line of dataLines) {
        // Parse CSV line (handle quoted values)
        const matches = line.match(/("([^"]*)"|[^,]+)/g) || [];
        const values = matches.map((v) => v.replace(/^"|"$/g, "").trim());

        if (values.length >= 1) {
          const [name, documentType, recurrence, departmentName, content] = values;

          // Find department by name
          const department = departments.find((d) => d.name.toLowerCase() === departmentName?.toLowerCase());

          try {
            const response = await fetch("/api/policies", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                documentType: documentType || "Policy",
                recurrence: recurrence || null,
                departmentId: department?.id || null,
                content: content || null,
                status: "Not Uploaded",
              }),
            });

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        }
      }

      alert(`Import completed: ${successCount} policies imported, ${errorCount} errors`);
      setImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchPolicies();
    } catch (error) {
      console.error("Error importing policies:", error);
      alert("Failed to import policies. Please check the file format.");
    } finally {
      setImporting(false);
    }
  };

  const filteredPolicies = policies.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
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
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/master-data")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Governance</h1>
            <p className="text-gray-600">Manage policies, standards, and procedures</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Policies
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Search and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search governance documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Department Name</TableHead>
                <TableHead>Policy Requirement</TableHead>
                <TableHead>Recurrence</TableHead>
                <TableHead>Entities</TableHead>
                <TableHead>Policy Code</TableHead>
                <TableHead>Document Type</TableHead>
                <TableHead className="w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPolicies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">
                    <p className="text-gray-500">No governance documents found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPolicies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[policy.status] || "bg-gray-100"}>
                        {policy.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{policy.assignee?.fullName || "-"}</TableCell>
                    <TableCell>{policy.approver?.fullName || "-"}</TableCell>
                    <TableCell>{policy.department?.name || "-"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {policy.content || "-"}
                    </TableCell>
                    <TableCell>{policy.recurrence || "-"}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>{policy.code}</TableCell>
                    <TableCell>{policy.documentType}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(policy)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(policy)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {filteredPolicies.length} of {total} documents
            </div>
            {totalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                >
                  Last
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog - 3-Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Policies</DialogTitle>
          </DialogHeader>

          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Button
                variant={wizardStep >= 1 ? "default" : "outline"}
                size="sm"
                className={`rounded-full w-8 h-8 p-0 ${wizardStep >= 1 ? "bg-blue-600" : ""}`}
                onClick={() => setWizardStep(1)}
              >
                {wizardStep > 1 ? "✓" : "1"}
              </Button>
              <span className={`text-sm ${wizardStep === 1 ? "font-medium" : "text-gray-500"}`}>
                Policy Information
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={wizardStep >= 2 ? "default" : "outline"}
                size="sm"
                className={`rounded-full w-8 h-8 p-0 ${wizardStep >= 2 ? "bg-blue-600" : ""}`}
                onClick={() => wizardStep > 1 && setWizardStep(2)}
              >
                {wizardStep > 2 ? "✓" : "2"}
              </Button>
              <span className={`text-sm ${wizardStep === 2 ? "font-medium" : "text-gray-500"}`}>
                Assignments & Details
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={wizardStep >= 3 ? "default" : "outline"}
                size="sm"
                className={`rounded-full w-8 h-8 p-0 ${wizardStep >= 3 ? "bg-blue-600" : ""}`}
                onClick={() => wizardStep > 2 && setWizardStep(3)}
              >
                3
              </Button>
              <span className={`text-sm ${wizardStep === 3 ? "font-medium" : "text-gray-500"}`}>
                Review informations
              </span>
            </div>
          </div>

          {/* Step 1: Policy Information */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Policy Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter policy name"
                />
              </div>
              <div>
                <Label>Department *</Label>
                <Select
                  value={formData.departmentId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      departmentId: value === "none" ? "" : value,
                      assigneeId: "", // Reset assignee when department changes
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select department</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Document type *</Label>
                <Select
                  value={formData.documentType || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, documentType: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select document type</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recurrence *</Label>
                <Select
                  value={formData.recurrence || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, recurrence: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select recurrence</SelectItem>
                    {recurrenceOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!formData.recurrence && formData.name && (
                  <p className="text-red-500 text-sm mt-1">Please select the recurrence</p>
                )}
              </div>
              <div>
                <Label>Assignee *</Label>
                <Select
                  value={formData.assigneeId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigneeId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select assignee</SelectItem>
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!formData.assigneeId && formData.departmentId && (
                  <p className="text-red-500 text-sm mt-1">Please select the assignee</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setWizardStep(2)}
                  disabled={!formData.name || !formData.departmentId || !formData.documentType || !formData.recurrence || !formData.assigneeId}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Assignments & Details - Link Controls */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              {/* Filters Row */}
              <div className="flex gap-4">
                <Select
                  value={controlCategoryFilter || "all"}
                  onValueChange={(value) => setControlCategoryFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Clear Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Clear Filter</SelectItem>
                    {policyCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={frameworkFilter || "all"}
                  onValueChange={(value) => setFrameworkFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Clear Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Clear Filter</SelectItem>
                    {frameworks.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={functionalGroupingFilter || "all"}
                  onValueChange={(value) => setFunctionalGroupingFilter(value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Clear Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Clear Filter</SelectItem>
                    {functionalGroupings.map((fg) => (
                      <SelectItem key={fg} value={fg}>
                        {fg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search By Control Code , Name"
                  value={controlSearchTerm}
                  onChange={(e) => setControlSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Controls List */}
              <div className="border rounded-lg max-h-[350px] overflow-y-auto">
                {filteredControls.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No controls found</div>
                ) : (
                  filteredControls.map((control) => (
                    <div
                      key={control.id}
                      className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleControlSelection(control.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedControlIds.has(control.id)}
                          onCheckedChange={() => toggleControlSelection(control.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {control.controlCode} : {control.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              {control.entities || "Organization Wide"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {control.description || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="text-sm text-gray-500">
                Selected: {selectedControlIds.size} controls
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  Previous
                </Button>
                <Button onClick={() => setWizardStep(3)}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Review Information */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <h4 className="font-medium text-lg">Policy Information</h4>
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <h5 className="font-medium text-sm text-gray-500">Policy Name</h5>
                  <p className="text-sm">{formData.name}</p>
                </div>
                <div>
                  <h5 className="font-medium text-sm text-gray-500">Policy Code</h5>
                  <p className="text-sm text-gray-400">(Auto-generated)</p>
                </div>
                <div>
                  <h5 className="font-medium text-sm text-gray-500">Document Type</h5>
                  <p className="text-sm">{formData.documentType}</p>
                </div>
                <div>
                  <h5 className="font-medium text-sm text-gray-500">Recurrence</h5>
                  <p className="text-sm">{formData.recurrence}</p>
                </div>
                <div>
                  <h5 className="font-medium text-sm text-gray-500">Department</h5>
                  <p className="text-sm">
                    {departments.find((d) => d.id === formData.departmentId)?.name || "-"}
                  </p>
                </div>
                <div>
                  <h5 className="font-medium text-sm text-gray-500">Assignee</h5>
                  <p className="text-sm">
                    {users.find((u) => u.id === formData.assigneeId)?.fullName || "-"}
                  </p>
                </div>
              </div>

              <h4 className="font-medium text-lg mt-6">Linked Controls ({selectedControlIds.size})</h4>
              <div className="border rounded-lg max-h-[200px] overflow-y-auto">
                {selectedControlIds.size === 0 ? (
                  <div className="p-4 text-center text-gray-500">No controls selected</div>
                ) : (
                  Array.from(selectedControlIds).map((controlId) => {
                    const control = controls.find((c) => c.id === controlId);
                    if (!control) return null;
                    return (
                      <div key={control.id} className="p-3 border-b last:border-b-0">
                        <div className="font-medium text-sm">
                          {control.controlCode} : {control.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {control.entities || "Organization Wide"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={() => setWizardStep(2)}>
                  Previous
                </Button>
                <Button onClick={handleCreate}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Policy Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Document Type</Label>
                <Select
                  value={formData.documentType || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, documentType: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Policy Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Department</Label>
                <Select
                  value={formData.departmentId || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      departmentId: value === "none" ? "" : value,
                      assigneeId: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recurrence</Label>
                <Select
                  value={formData.recurrence || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, recurrence: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {recurrenceOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assignee</Label>
                <Select
                  value={formData.assigneeId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigneeId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Approver</Label>
                <Select
                  value={formData.approverId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, approverId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Not Uploaded">Not Uploaded</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Needs Review">Needs Review</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                  <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedPolicy(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={!formData.code || !formData.name}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedPolicy?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Policies</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>File</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              {importFile && (
                <p className="text-sm text-gray-500 mt-1">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false);
                    setImportFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                >
                  {importing ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
