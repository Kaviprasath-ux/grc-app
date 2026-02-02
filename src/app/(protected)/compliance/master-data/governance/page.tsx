"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Search, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

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
  "Published": "bg-success-light text-success-dark",
  "Draft": "bg-warning-light text-warning-dark",
  "Approved": "bg-info-light text-info-dark",
  "Needs Review": "bg-warning-light text-warning-dark",
  "Not Uploaded": "bg-slate-100 text-slate-600",
  "Pending Approval": "bg-primary-100 text-primary-700",
};

const documentTypes = ["Policy", "Standard", "Procedure"];
const recurrenceOptions = ["Weekly", "Monthly", "Quarterly", "Yearly"];
const functionalGroupings = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"];

export default function GovernanceMasterDataPage() {
  const router = useRouter();
  const { toast } = useToast();
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

      toast({ title: "Success", description: `Import completed: ${successCount} policies imported, ${errorCount} errors` });
      setImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchPolicies();
    } catch (error) {
      console.error("Error importing policies:", error);
      toast({ title: "Error", description: "Failed to import policies. Please check the file format.", variant: "destructive" });
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
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-primary/30"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>Compliance</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Link href="/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
          Master Data
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">Governance</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800">Governance</h1>
      </div>

      {/* Search and Actions - same row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search governance documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[300px] bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Policies
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">Policy Name</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Assignee</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Approver</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Department</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Requirement</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Recurrence</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Code</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">Type</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPolicies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <p className="text-slate-500">No governance documents found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredPolicies.map((policy) => (
                <TableRow key={policy.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 pl-4">{policy.name}</TableCell>
                  <TableCell className="py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[policy.status] || "bg-slate-100 text-slate-600"}`}>
                      {policy.status}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{policy.assignee?.fullName || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{policy.approver?.fullName || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{policy.department?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600 max-w-[150px] truncate">
                    {policy.content || "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{policy.recurrence || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{policy.code}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{policy.documentType}</TableCell>
                  <TableCell className="py-3 text-sm pr-4">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(policy)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(policy)}
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Showing {filteredPolicies.length} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600 px-2">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Create Dialog - 3-Step Wizard */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">New Policies</DialogTitle>
          </div>

          {/* Step Indicators */}
          <div className="flex-shrink-0 flex items-center justify-center px-6 py-4 bg-slate-50/50 border-b border-slate-100">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium ${
                  step === wizardStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : step < wizardStep
                      ? "bg-success text-white border-success"
                      : "bg-white border-slate-300 text-slate-500"
                }`}>
                  {step < wizardStep ? <Check className="h-4 w-4" /> : step}
                </div>
                <span className={`ml-2 text-sm ${
                  step === wizardStep ? "text-slate-800 font-medium" : "text-slate-500"
                }`}>
                  {step === 1 ? "Policy Information" : step === 2 ? "Link Controls" : "Review"}
                </span>
                {step < 3 && <div className="w-12 h-0.5 bg-slate-200 mx-3" />}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Step 1: Policy Information */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Policy Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter policy name"
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Department <span className="text-red-500">*</span>
                  </Label>
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
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
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
                  <Label className="text-sm font-medium text-slate-700">
                    Document type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.documentType || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, documentType: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
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
                  <Label className="text-sm font-medium text-slate-700">
                    Recurrence <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.recurrence || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, recurrence: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select recurrence" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
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
                  <Label className="text-sm font-medium text-slate-700">
                    Assignee <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.assigneeId || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, assigneeId: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger className="mt-1.5 w-full bg-white">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
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
              </div>
            )}

            {/* Step 2: Assignments & Details - Link Controls */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                {/* Filters Row */}
                <div className="grid grid-cols-3 gap-4">
                  <Select
                    value={controlCategoryFilter || "all"}
                    onValueChange={(value) => setControlCategoryFilter(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">All Categories</SelectItem>
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
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="All Frameworks" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">All Frameworks</SelectItem>
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
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="All Groupings" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">All Groupings</SelectItem>
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search By Control Code, Name"
                    value={controlSearchTerm}
                    onChange={(e) => setControlSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>

                {/* Controls List */}
                <div className="border border-slate-200 rounded-lg max-h-[350px] overflow-y-auto">
                  {filteredControls.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">No controls found</div>
                  ) : (
                    filteredControls.map((control) => (
                      <div
                        key={control.id}
                        className={`p-3 border-b border-slate-200 last:border-b-0 hover:bg-slate-50 cursor-pointer ${
                          selectedControlIds.has(control.id) ? "bg-primary/5" : ""
                        }`}
                        onClick={() => toggleControlSelection(control.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedControlIds.has(control.id)}
                            onCheckedChange={() => toggleControlSelection(control.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-800">
                                {control.controlCode} : {control.name}
                              </span>
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                {control.entities || "Organization Wide"}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                              {control.description || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <p className="text-sm text-slate-500">
                  {selectedControlIds.size} control(s) selected
                </p>
              </div>
            )}

            {/* Step 3: Review Information */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h4 className="font-medium text-slate-800">Policy Information</h4>
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Policy Name</Label>
                    <p className="text-sm text-slate-800 mt-1">{formData.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Policy Code</Label>
                    <p className="text-sm text-slate-500 mt-1">(Auto-generated)</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Document Type</Label>
                    <p className="text-sm text-slate-800 mt-1">{formData.documentType}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Recurrence</Label>
                    <p className="text-sm text-slate-800 mt-1">{formData.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Department</Label>
                    <p className="text-sm text-slate-800 mt-1">
                      {departments.find((d) => d.id === formData.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">Assignee</Label>
                    <p className="text-sm text-slate-800 mt-1">
                      {users.find((u) => u.id === formData.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                </div>

                <h4 className="font-medium text-slate-800 mt-6">Linked Controls ({selectedControlIds.size})</h4>
                <div className="border border-slate-200 rounded-lg max-h-[200px] overflow-y-auto">
                  {selectedControlIds.size === 0 ? (
                    <div className="p-4 text-center text-slate-500">No controls selected</div>
                  ) : (
                    Array.from(selectedControlIds).map((controlId) => {
                      const control = controls.find((c) => c.id === controlId);
                      if (!control) return null;
                      return (
                        <div key={control.id} className="p-3 border-b border-slate-200 last:border-b-0">
                          <div className="font-medium text-sm text-slate-800">
                            {control.controlCode} : {control.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {control.entities || "Organization Wide"}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            {wizardStep > 1 && (
              <Button variant="outline" size="sm" onClick={() => setWizardStep(wizardStep - 1)}>
                Previous
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            {wizardStep < 3 ? (
              <Button
                size="sm"
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={wizardStep === 1 && (!formData.name || !formData.departmentId || !formData.documentType || !formData.recurrence || !formData.assigneeId)}
              >
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreate}>
                Save
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">Edit Policy</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  Policy Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  className="mt-1.5 w-full bg-white"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">Document Type</Label>
                <Select
                  value={formData.documentType || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, documentType: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
              <Label className="text-sm font-medium text-slate-700">
                Policy Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1.5 w-full bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">Department</Label>
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
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
                <Label className="text-sm font-medium text-slate-700">Recurrence</Label>
                <Select
                  value={formData.recurrence || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, recurrence: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
                <Label className="text-sm font-medium text-slate-700">Assignee</Label>
                <Select
                  value={formData.assigneeId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigneeId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
                <Label className="text-sm font-medium text-slate-700">Approver</Label>
                <Select
                  value={formData.approverId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, approverId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder="Select approver" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
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
              <Label className="text-sm font-medium text-slate-700">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="mt-1.5 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="Not Uploaded">Not Uploaded</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Needs Review">Needs Review</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                  <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedPolicy(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEdit}
              disabled={!formData.code || !formData.name}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">Delete Policy</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              Are you sure you want to delete &quot;{selectedPolicy?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="px-6 py-4 bg-white rounded-b-lg">
            <AlertDialogCancel className="h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 h-9"
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
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">Import Policies</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">File</Label>
              <Input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="mt-1.5 w-full bg-white"
              />
              {importFile && (
                <p className="text-sm text-slate-500 mt-1">
                  Selected: {importFile.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
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
                size="sm"
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? (
                  <>
                    <div className="relative h-4 w-4 mr-2">
                      <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    </div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
