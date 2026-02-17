"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { ArrowLeft, Plus, Pencil, Trash2, Download, Upload, Search, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Home, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

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
  const { t } = useLanguage();
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
  const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});

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
    setPolicyErrors({});
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

      toast({ title: t("Success"), description: t("Import completed") + `: ${successCount} ` + t("policies imported") + `, ${errorCount} ` + t("errors") });
      setImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchPolicies();
    } catch (error) {
      console.error("Error importing policies:", error);
      toast({ title: t("Error"), description: t("Failed to import policies. Please check the file format."), variant: "destructive" });
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb and Header */}
      <div className="flex flex-col gap-1">
        <nav className="flex items-center gap-1.5 text-xs sm:text-sm overflow-x-auto whitespace-nowrap">
          <Link href="/grc" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("GRC")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-500">{t("Compliance")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <Link href="/roles/grc-administrator/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Master Data")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Governance")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Governance")}</h1>
      </div>

      {/* Search and Actions - same row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search governance documents...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full sm:w-[300px] bg-white border-slate-200"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="w-full sm:w-auto">
            <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Import")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="w-full sm:w-auto">
            <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("Export")}
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t("New Policies")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pl-4">{t("Policy Name")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Status")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Assignee")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Approver")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Department")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Requirement")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Recurrence")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Code")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12">{t("Type")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 h-12 pr-4 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPolicies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-6 w-6 text-primary-500" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      {t("No Governance Documents Found")}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {t("Create a new governance document to get started.")}
                    </p>
                  </div>
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
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            {t("Showing")} {filteredPolicies.length} {t("of")} {total}
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
              {t("Page")} {page} {t("of")} {totalPages || 1}
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("New Policies")}</DialogTitle>
          </div>

          {/* Step Indicators */}
          <div className="flex-shrink-0 flex items-center justify-center px-4 sm:px-6 py-4 bg-slate-50/50 border-b border-slate-100">
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
                <span className={`hidden sm:inline ltr:ml-2 rtl:mr-2 text-sm ${
                  step === wizardStep ? "text-slate-800 font-medium" : "text-slate-500"
                }`}>
                  {step === 1 ? t("Policy Information") : step === 2 ? t("Link Controls") : t("Review")}
                </span>
                {step < 3 && <div className="w-6 sm:w-12 h-0.5 bg-slate-200 mx-1.5 sm:mx-3" />}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {/* Step 1: Policy Information */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Policy Name")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (policyErrors.name) setPolicyErrors((prev) => { const { name, ...rest } = prev; return rest; });
                    }}
                    placeholder={t("Enter policy name")}
                    className={`mt-1.5 w-full bg-white ${policyErrors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                  />
                  {policyErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{policyErrors.name}</p>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Department")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.departmentId || "none"}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        departmentId: value === "none" ? "" : value,
                        assigneeId: "",
                      });
                      if (policyErrors.departmentId) setPolicyErrors((prev) => { const { departmentId, ...rest } = prev; return rest; });
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.departmentId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select department")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="none">{t("Select department")}</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
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
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Document type")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.documentType || "none"}
                    onValueChange={(value) => {
                      setFormData({ ...formData, documentType: value === "none" ? "" : value });
                      if (policyErrors.documentType) setPolicyErrors((prev) => { const { documentType, ...rest } = prev; return rest; });
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.documentType ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select document type")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="none">{t("Select document type")}</SelectItem>
                      {documentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(type)}
                        </SelectItem>
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
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Recurrence")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.recurrence || "none"}
                    onValueChange={(value) => {
                      setFormData({ ...formData, recurrence: value === "none" ? "" : value });
                      if (policyErrors.recurrence) setPolicyErrors((prev) => { const { recurrence, ...rest } = prev; return rest; });
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.recurrence ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select recurrence")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="none">{t("Select recurrence")}</SelectItem>
                      {recurrenceOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {t(option)}
                        </SelectItem>
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
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Assignee")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.assigneeId || "none"}
                    onValueChange={(value) => {
                      setFormData({ ...formData, assigneeId: value === "none" ? "" : value });
                      if (policyErrors.assigneeId) setPolicyErrors((prev) => { const { assigneeId, ...rest } = prev; return rest; });
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${policyErrors.assigneeId ? "border-red-500 focus:ring-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select assignee")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="none">{t("Select assignee")}</SelectItem>
                      {filteredUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName}
                        </SelectItem>
                      ))}
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

            {/* Step 2: Assignments & Details - Link Controls */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Select
                    value={controlCategoryFilter || "all"}
                    onValueChange={(value) => setControlCategoryFilter(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("All Categories")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Categories")}</SelectItem>
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
                      <SelectValue placeholder={t("All Frameworks")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Frameworks")}</SelectItem>
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
                      <SelectValue placeholder={t("All Groupings")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="all">{t("All Groupings")}</SelectItem>
                      {functionalGroupings.map((fg) => (
                        <SelectItem key={fg} value={fg}>
                          {t(fg)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t("Search By Control Code, Name")}
                    value={controlSearchTerm}
                    onChange={(e) => setControlSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>

                {/* Controls List */}
                <div className="border border-slate-200 rounded-lg max-h-[350px] overflow-y-auto">
                  {filteredControls.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">{t("No controls found")}</div>
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
                                {control.entities || t("Organization Wide")}
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
                  {selectedControlIds.size} {t("control(s) selected")}
                </p>
              </div>
            )}

            {/* Step 3: Review Information */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <h4 className="font-medium text-slate-800">{t("Policy Information")}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Policy Name")}</Label>
                    <p className="text-sm text-slate-800 mt-1">{formData.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Policy Code")}</Label>
                    <p className="text-sm text-slate-500 mt-1">({t("Auto-generated")})</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Document Type")}</Label>
                    <p className="text-sm text-slate-800 mt-1">{t(formData.documentType)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Recurrence")}</Label>
                    <p className="text-sm text-slate-800 mt-1">{t(formData.recurrence)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                    <p className="text-sm text-slate-800 mt-1">
                      {departments.find((d) => d.id === formData.departmentId)?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Assignee")}</Label>
                    <p className="text-sm text-slate-800 mt-1">
                      {users.find((u) => u.id === formData.assigneeId)?.fullName || "-"}
                    </p>
                  </div>
                </div>

                <h4 className="font-medium text-slate-800 mt-6">{t("Linked Controls")} ({selectedControlIds.size})</h4>
                <div className="border border-slate-200 rounded-lg max-h-[200px] overflow-y-auto">
                  {selectedControlIds.size === 0 ? (
                    <div className="p-4 text-center text-slate-500">{t("No controls selected")}</div>
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
                            {control.entities || t("Organization Wide")}
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
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            {wizardStep > 1 && (
              <Button variant="outline" size="sm" onClick={() => setWizardStep(wizardStep - 1)}>
                {t("Previous")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setCreateDialogOpen(false); }}>
              {t("Cancel")}
            </Button>
            {wizardStep < 3 ? (
              <Button
                size="sm"
                onClick={() => {
                  if (wizardStep === 1) {
                    const errors: Record<string, string> = {};
                    if (!formData.name) errors.name = t("Please enter the policy name");
                    if (!formData.departmentId) errors.departmentId = t("Please select the Department");
                    if (!formData.documentType) errors.documentType = t("Please select the document type");
                    if (!formData.recurrence) errors.recurrence = t("Please select the recurrence");
                    if (!formData.assigneeId) errors.assigneeId = t("Please select the assignee");
                    if (Object.keys(errors).length > 0) { setPolicyErrors(errors); return; }
                    setPolicyErrors({});
                  }
                  setWizardStep(wizardStep + 1);
                }}
              >
                {t("Next")}
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreate}>
                {t("Save")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Edit Policy")}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Policy Code")} <span className="text-red-500">*</span>
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
                <Label className="text-sm font-medium text-slate-700">{t("Document Type")}</Label>
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
                    <SelectItem value="none">{t("None")}</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">
                {t("Policy Name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="mt-1.5 w-full bg-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
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
                    <SelectValue placeholder={t("Select department")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="none">{t("None")}</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Recurrence")}</Label>
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
                    <SelectItem value="none">{t("None")}</SelectItem>
                    {recurrenceOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {t(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Assignee")}</Label>
                <Select
                  value={formData.assigneeId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigneeId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select assignee")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="none">{t("None")}</SelectItem>
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Approver")}</Label>
                <Select
                  value={formData.approverId || "none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, approverId: value === "none" ? "" : value })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select approver")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="none">{t("None")}</SelectItem>
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
              <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
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
                  <SelectItem value="Not Uploaded">{t("Not Uploaded")}</SelectItem>
                  <SelectItem value="Draft">{t("Draft")}</SelectItem>
                  <SelectItem value="Approved">{t("Approved")}</SelectItem>
                  <SelectItem value="Needs Review">{t("Needs Review")}</SelectItem>
                  <SelectItem value="Published">{t("Published")}</SelectItem>
                  <SelectItem value="Pending Approval">{t("Pending Approval")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-shrink-0 flex justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedPolicy(null);
                resetForm();
              }}
            >
              {t("Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleEdit}
              disabled={!formData.code || !formData.name}
            >
              {t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg p-0 gap-0">
          <AlertDialogHeader className="px-4 sm:px-6 py-5">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Delete Policy")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete")} &quot;{selectedPolicy?.name}&quot;? {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("Delete")}
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
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
          <div className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">{t("Import Policies")}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Input
                  readOnly
                  value={importFile?.name || ""}
                  placeholder={t("Choose a file...")}
                  className="flex-1 bg-white min-w-0"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0"
                >
                  {t("Browse...")}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileChange}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {t("Supported formats")}: CSV
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Download Template")}
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
                {t("Cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                {importing ? (
                  <>
                    <div className="relative h-4 w-4 ltr:mr-2 rtl:ml-2">
                      <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                      <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    </div>
                    {t("Importing...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                    {t("Import")}
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
