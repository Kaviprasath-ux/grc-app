"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Home,
  FileCheck,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { isValidName } from "@/lib/validations";

interface Evidence {
  id: string;
  evidenceCode: string;
  name: string;
  description: string | null;
  status: string;
  recurrence: string | null;
  reviewDate: string | null;
  domain: string | null;
  entities: string | null;
  isControlLinked: boolean;
  isPolicyLinked: boolean;
  artifactDescription: string | null;
  isKPI: boolean;
  kpiDescription: string | null;
  kpiExpectedScore: number | null;
  kpiObjective: string | null;
  kpiDataSource: string | null;
  kpiCalculationFormula: string | null;
  aiStatus: string | null;
  aiJustification: string | null;
  isAdded: boolean;
  department: { id: string; name: string } | null;
  controls: { id: string; name: string }[];
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  departmentId?: string;
  userRoles?: { role: { name: string } }[];
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description?: string;
  domain?: { id: string; name: string } | null;
  functionalGrouping?: string | null;
}

interface ControlDomain {
  id: string;
  name: string;
}

interface Framework {
  id: string;
  name: string;
}

interface NewEvidenceFormData {
  name: string;
  recurrence: string;
  departmentId: string;
  assigneeId: string;
  description: string;
  controlIds: string[];
}

export default function EvidencesMasterDataPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [controlDomains, setControlDomains] = useState<ControlDomain[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // New Evidence Dialog (3-step wizard)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newStep, setNewStep] = useState(1);
  const [newFormData, setNewFormData] = useState<NewEvidenceFormData>({
    name: "",
    recurrence: "",
    departmentId: "",
    assigneeId: "",
    description: "",
    controlIds: [],
  });
  const [newFormErrors, setNewFormErrors] = useState<Record<string, string>>({});

  // Step 2 Filters
  const [controlSearch, setControlSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("");
  const [functionalGroupingFilter, setFunctionalGroupingFilter] = useState("");

  // Edit Evidence Dialog (single page)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [editControlId, setEditControlId] = useState<string>("");
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete All Dialog
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  // Import Dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  const fetchEvidences = useCallback(async () => {
    try {
      const response = await fetch("/api/evidences");
      if (response.ok) {
        const data = await response.json();
        setEvidences(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching evidences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users?role=DepartmentContributor");
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchControls = useCallback(async () => {
    try {
      const response = await fetch("/api/controls");
      if (response.ok) {
        const data = await response.json();
        setControls(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching controls:", error);
    }
  }, []);

  const fetchControlDomains = useCallback(async () => {
    try {
      const response = await fetch("/api/control-domains");
      if (response.ok) {
        const data = await response.json();
        setControlDomains(Array.isArray(data) ? data : data.data || []);
      }
    } catch (error) {
      console.error("Error fetching control domains:", error);
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

  useEffect(() => {
    fetchEvidences();
    fetchDepartments();
    fetchUsers();
    fetchControls();
    fetchControlDomains();
    fetchFrameworks();
  }, [fetchEvidences, fetchDepartments, fetchUsers, fetchControls, fetchControlDomains, fetchFrameworks]);

  // Dynamic translation hooks
  const { data: translatedEvidences } = useTranslatedData(evidences, { modelName: 'Evidence' });
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedControls } = useTranslatedData(controls, { modelName: 'Control' });
  const { data: translatedControlDomains } = useTranslatedData(controlDomains, { modelName: 'ControlDomain' });
  const { data: translatedFrameworks } = useTranslatedData(frameworks, { modelName: 'Framework' });

  // Filter users by selected department and DepartmentContributor role only
  const filteredUsers = users.filter(
    (user) =>
      (!newFormData.departmentId || user.departmentId === newFormData.departmentId) &&
      user.userRoles?.some((ur) => ur.role.name === "DepartmentContributor")
  );

  // Filter controls based on search and filters (use translated controls for display)
  const filteredControls = translatedControls.filter((control) => {
    const matchesSearch =
      !controlSearch ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.name.toLowerCase().includes(controlSearch.toLowerCase());
    const matchesDomain =
      !domainFilter || control.domain?.id === domainFilter;
    const matchesFunctionalGrouping =
      !functionalGroupingFilter || control.functionalGrouping === functionalGroupingFilter;
    return matchesSearch && matchesDomain && matchesFunctionalGrouping;
  });

  // Get unique functional groupings from controls
  const functionalGroupings = [...new Set(controls.map((c) => c.functionalGrouping).filter(Boolean))];

  const handleExport = () => {
    const csv = [
      ["Evidence Code", "Title", "Evidence Requirement"],
      ...translatedEvidences.map((e) => [
        e.evidenceCode,
        e.name,
        e.description || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidences-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const csv = ["Evidence Code,Title,Evidence Requirement", "E-001,Sample Domain,Sample Evidence Requirement"].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evidence-import-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // New Evidence - Step 1 Validation
  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!newFormData.name) {
      errors.name = t("Please enter the evidence name");
    } else if (!isValidName(newFormData.name.trim())) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!newFormData.recurrence) errors.recurrence = t("Please select the recurrence");
    if (!newFormData.departmentId) errors.departmentId = t("Please select the Department");
    if (!newFormData.assigneeId) errors.assigneeId = t("Please select the assignee");
    setNewFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNewNext = () => {
    if (newStep === 1) {
      if (validateStep1()) {
        setNewStep(2);
      }
    } else if (newStep === 2) {
      setNewStep(3);
    }
  };

  const handleNewBack = () => {
    if (newStep > 1) {
      setNewStep(newStep - 1);
    }
  };

  const handleNewSubmit = async () => {
    try {
      const response = await fetch("/api/evidences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFormData.name,
          description: newFormData.description,
          recurrence: newFormData.recurrence,
          departmentId: newFormData.departmentId,
          status: "Draft",
          controlIds: newFormData.controlIds,
        }),
      });

      if (response.ok) {
        const savedData = await response.json();
        triggerTranslation('Evidence', savedData.id, { name: newFormData.name, description: newFormData.description });
        toast({
          title: t("Success"),
          description: t("Evidence created successfully"),
        });
        setIsNewDialogOpen(false);
        resetNewForm();
        fetchEvidences();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.message || t("Failed to create evidence"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating evidence:", error);
      toast({
        title: t("Error"),
        description: t("Failed to create evidence"),
        variant: "destructive",
      });
    }
  };

  const resetNewForm = () => {
    setNewFormData({
      name: "",
      recurrence: "",
      departmentId: "",
      assigneeId: "",
      description: "",
      controlIds: [],
    });
    setNewFormErrors({});
    setNewStep(1);
    setControlSearch("");
    setDomainFilter("");
    setFrameworkFilter("");
    setFunctionalGroupingFilter("");
  };

  const handleEdit = (evidence: Evidence) => {
    setEditingEvidence(evidence);
    setEditControlId(evidence.controls?.[0]?.id || "");
    setIsEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingEvidence) return;

    const errors: Record<string, string> = {};
    if (!editingEvidence.name) {
      errors.name = t("Please enter the evidence name");
    } else if (!isValidName(editingEvidence.name.trim())) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }
    setEditFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const response = await fetch(`/api/evidences/${editingEvidence.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingEvidence,
          controlIds: editControlId ? [editControlId] : [],
        }),
      });

      if (response.ok) {
        triggerTranslation('Evidence', editingEvidence.id, { name: editingEvidence.name, description: editingEvidence.description });
        toast({
          title: t("Success"),
          description: t("Evidence updated successfully"),
        });
        setIsEditDialogOpen(false);
        setEditingEvidence(null);
        setEditControlId("");
        fetchEvidences();
      } else {
        const error = await response.json();
        toast({
          title: t("Error"),
          description: error.message || t("Failed to update evidence"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating evidence:", error);
      toast({
        title: t("Error"),
        description: t("Failed to update evidence"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/evidences/${deletingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: t("Success"),
          description: t("Evidence deleted successfully"),
        });
        fetchEvidences();
      } else {
        toast({
          title: t("Error"),
          description: t("Failed to delete evidence"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting evidence:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete evidence"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const deletePromises = evidences.map((evidence) =>
        fetch(`/api/evidences/${evidence.id}`, { method: "DELETE" })
      );

      await Promise.all(deletePromises);

      toast({
        title: t("Success"),
        description: t("All evidences deleted successfully"),
      });
      fetchEvidences();
    } catch (error) {
      console.error("Error deleting all evidences:", error);
      toast({
        title: t("Error"),
        description: t("Failed to delete all evidences"),
        variant: "destructive",
      });
    } finally {
      setDeleteAllDialogOpen(false);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile) {
      toast({
        title: t("Error"),
        description: t("Please select a file to import"),
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n");
        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
          const evidenceData: Record<string, string> = {};

          headers.forEach((header, index) => {
            if (header === "Evidence Code") evidenceData.evidenceCode = values[index];
            else if (header === "Title") evidenceData.name = values[index];
            else if (header === "Evidence Requirement") evidenceData.description = values[index];
          });

          await fetch("/api/evidences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...evidenceData,
              status: "Draft",
            }),
          });
        }

        toast({
          title: t("Success"),
          description: t("Evidences imported successfully"),
        });
        fetchEvidences();
        setImportDialogOpen(false);
        setImportName("");
        setImportFile(null);
      } catch (error) {
        console.error("Error importing evidences:", error);
        toast({
          title: t("Error"),
          description: t("Failed to import evidences"),
          variant: "destructive",
        });
      }
    };
    reader.readAsText(importFile);
  };

  // Get selected controls for review (use translated controls for display)
  const selectedControls = translatedControls.filter((c) => newFormData.controlIds.includes(c.id));
  const selectedDomains = [...new Set(selectedControls.map((c) => c.domain?.name).filter(Boolean))];

  // Filter evidences based on search (use translated data for display)
  const filteredEvidences = translatedEvidences.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.evidenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredEvidences.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEvidences = filteredEvidences.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <Link href="" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Compliance")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-slate-500">{t("Compliance Settings")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Evidences")}</span>
        </nav>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Evidences")}</h1>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500 ">
          <Home className="h-4 w-4" />
          <span>{t("Compliance")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/compliance/master-data" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Compliance Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Evidences")}</span>
      </nav>

      {/* Header */}
      <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Evidences")}</h1>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Import")}
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Export")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="col-span-2 sm:col-span-1"
          onClick={() => setDeleteAllDialogOpen(true)}
          disabled={evidences.length === 0}
        >
          <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("Delete All")}
        </Button>
        <Button size="sm" className="col-span-2 sm:col-span-1" onClick={() => { resetNewForm(); setIsNewDialogOpen(true); }}>
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("New Evidence")}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search inside card */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder={t("Search evidences...")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-[300px] ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors" />
          </div>
        </div>

        <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 ps-5">{t("Evidence Code")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Title")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Evidence Requirement")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pe-5 w-[100px]">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedEvidences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-0">
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                      <FileCheck className="h-6 w-6 text-primary-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">{t("No evidences found")}</p>
                    <p className="text-xs text-slate-400">
                      {searchTerm ? t("Try adjusting your search") : t("Create a new evidence to get started")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedEvidences.map((evidence) => (
                <TableRow key={evidence.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                  <TableCell className="py-3 text-sm font-medium text-slate-800 ps-5">{evidence.evidenceCode}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{evidence.name}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{evidence.description || "-"}</TableCell>
                  <TableCell className="py-3 text-sm pe-5">
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => handleEdit(evidence)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => handleDelete(evidence.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-500">
            {filteredEvidences.length > 0
              ? `${startIndex + 1} ${t("to")} ${Math.min(startIndex + itemsPerPage, filteredEvidences.length)} ${t("of")} ${filteredEvidences.length}`
              : t("No evidences")}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* New Evidence Dialog - 3 Step Wizard */}
      <Dialog open={isNewDialogOpen} onOpenChange={(open) => {
        setIsNewDialogOpen(open);
        if (!open) resetNewForm();
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">
              {newStep === 1 ? t("Evidence Details") : newStep === 2 ? t("Controls") : t("Review Information")}
            </DialogTitle>
          </div>

          {/* Stepper */}
          <div className="flex-shrink-0 flex items-center justify-center px-4 sm:px-6 py-4 bg-slate-50/50 border-b border-slate-100">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium ${step === newStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : step < newStep
                      ? "bg-success text-white border-success"
                      : "bg-white border-slate-300 text-slate-500"
                  }`}>
                  {step < newStep ? <Check className="h-4 w-4" /> : step}
                </div>
                <span className={`hidden sm:inline ltr:ml-2 rtl:mr-2 text-sm ${step === newStep ? "text-slate-800 font-medium" : "text-slate-500"
                  }`}>
                  {step === 1 ? t("Evidence Details") : step === 2 ? t("Controls") : t("Review")}
                </span>
                {step < 3 && <div className="w-6 sm:w-12 h-0.5 bg-slate-200 mx-1.5 sm:mx-3" />}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            {/* Step 1: Evidence Details */}
            {newStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Evidence Requirement")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={newFormData.name}
                    onChange={(e) => {
                      setNewFormData({ ...newFormData, name: e.target.value });
                      if (newFormErrors.name) {
                        setNewFormErrors({ ...newFormErrors, name: "" });
                      }
                    }}
                    className={`mt-1.5 w-full bg-white ${newFormErrors.name ? "border-red-500" : ""}`}
                  />
                  {newFormErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{newFormErrors.name}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      {t("Recurrence")} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={newFormData.recurrence}
                      onValueChange={(value) => {
                        setNewFormData({ ...newFormData, recurrence: value });
                        if (newFormErrors.recurrence) {
                          setNewFormErrors({ ...newFormErrors, recurrence: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${newFormErrors.recurrence ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select recurrence")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="Yearly">{t("Yearly")}</SelectItem>
                        <SelectItem value="Half-yearly">{t("Half-yearly")}</SelectItem>
                        <SelectItem value="Quarterly">{t("Quarterly")}</SelectItem>
                        <SelectItem value="Monthly">{t("Monthly")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {newFormErrors.recurrence && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{newFormErrors.recurrence}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">
                      {t("Department")} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={newFormData.departmentId}
                      onValueChange={(value) => {
                        setNewFormData({ ...newFormData, departmentId: value, assigneeId: "" });
                        if (newFormErrors.departmentId) {
                          setNewFormErrors({ ...newFormErrors, departmentId: "" });
                        }
                      }}
                    >
                      <SelectTrigger className={`mt-1.5 w-full bg-white ${newFormErrors.departmentId ? "border-red-500" : ""}`}>
                        <SelectValue placeholder={t("Select department")} />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {translatedDepartments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newFormErrors.departmentId && (
                      <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                        <p className="text-sm text-red-600">{newFormErrors.departmentId}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Assignee")} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={newFormData.assigneeId}
                    onValueChange={(value) => {
                      setNewFormData({ ...newFormData, assigneeId: value });
                      if (newFormErrors.assigneeId) {
                        setNewFormErrors({ ...newFormErrors, assigneeId: "" });
                      }
                    }}
                  >
                    <SelectTrigger className={`mt-1.5 w-full bg-white ${newFormErrors.assigneeId ? "border-red-500" : ""}`}>
                      <SelectValue placeholder={t("Select assignee")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {filteredUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newFormErrors.assigneeId && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{newFormErrors.assigneeId}</p>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                  <Textarea
                    value={newFormData.description}
                    onChange={(e) =>
                      setNewFormData({ ...newFormData, description: e.target.value })
                    }
                    rows={4}
                    className="mt-1.5 w-full bg-white"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Controls */}
            {newStep === 2 && (
              <div className="space-y-4">
                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Select value={domainFilter || "_all"} onValueChange={(v) => setDomainFilter(v === "_all" ? "" : v)}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Domain")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="_all">{t("All Domains")}</SelectItem>
                      {translatedControlDomains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={frameworkFilter || "_all"} onValueChange={(v) => setFrameworkFilter(v === "_all" ? "" : v)}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Framework")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="_all">{t("All Frameworks")}</SelectItem>
                      {translatedFrameworks.map((framework) => (
                        <SelectItem key={framework.id} value={framework.id}>
                          {framework.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={functionalGroupingFilter || "_all"} onValueChange={(v) => setFunctionalGroupingFilter(v === "_all" ? "" : v)}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("Functional Grouping")} />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      <SelectItem value="_all">{t("All Groupings")}</SelectItem>
                      {functionalGroupings.map((grouping) => (
                        <SelectItem key={grouping} value={grouping!}>
                          {t(grouping!)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder={t("Search By Control Code, Name")}
                    value={controlSearch}
                    onChange={(e) => setControlSearch(e.target.value)}
                    className="ltr:pl-10 rtl:pr-10 bg-white"
                  />
                </div>

                {/* Controls List */}
                <div className="border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                  {filteredControls.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">{t("No controls found")}</div>
                  ) : (
                    filteredControls.map((control) => (
                      <div
                        key={control.id}
                        className={`p-4 border-b border-slate-200 last:border-b-0 cursor-pointer hover:bg-slate-50 ${newFormData.controlIds.includes(control.id) ? "bg-primary/5" : ""
                          }`}
                        onClick={() => {
                          if (newFormData.controlIds.includes(control.id)) {
                            setNewFormData({
                              ...newFormData,
                              controlIds: newFormData.controlIds.filter((id) => id !== control.id),
                            });
                          } else {
                            setNewFormData({
                              ...newFormData,
                              controlIds: [...newFormData.controlIds, control.id],
                            });
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={newFormData.controlIds.includes(control.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-800">
                                {control.controlCode} : {control.name}
                              </span>
                              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                {t(control.entities || "Organization Wide")}
                              </span>
                            </div>
                            {control.description && (
                              <p className="text-sm text-slate-600 mt-1">{control.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {newFormData.controlIds.length} {t("control(s) selected")}
                </p>
              </div>
            )}

            {/* Step 3: Review */}
            {newStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Evidence Name")}</Label>
                    <p className="mt-1 text-slate-800">{newFormData.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Control Domain")}</Label>
                    <p className="mt-1 text-slate-800">{selectedDomains.join(", ") || "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Recurrence")}</Label>
                    <p className="mt-1 text-slate-800">{newFormData.recurrence}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Entities")}</Label>
                    <p className="mt-1 text-slate-800">{newFormData.controlIds.length > 0 ? t("Organization Wide") : "-"}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                  <p className="mt-1 text-slate-800">
                    {translatedDepartments.find((d) => d.id === newFormData.departmentId)?.name || "-"}
                  </p>
                </div>
                {newFormData.description && (
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
                    <p className="mt-1 text-slate-800">{newFormData.description}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Selected Controls")}</Label>
                  <p className="mt-1 text-slate-800">{newFormData.controlIds.length} {t("control(s) selected")}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            {newStep > 1 && (
              <Button variant="outline" size="sm" onClick={handleNewBack}>
                {t("Previous")}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { resetNewForm(); setIsNewDialogOpen(false); }}>
              {t("Cancel")}
            </Button>
            {newStep < 3 ? (
              <Button size="sm" onClick={handleNewNext}>{t("Next")}</Button>
            ) : (
              <Button size="sm" onClick={handleNewSubmit}>{t("Create Evidence")}</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Evidence Dialog - Single Page */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingEvidence(null);
          setEditControlId("");
          setEditFormErrors({});
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Edit Evidence")}</DialogTitle>
          </div>

          {editingEvidence && (
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Evidence code")}</Label>
                  <Input value={editingEvidence.evidenceCode} disabled className="mt-1.5 bg-slate-50" />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Name")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={editingEvidence.name}
                    onChange={(e) => {
                      setEditingEvidence({ ...editingEvidence, name: e.target.value });
                      if (editFormErrors.name) {
                        setEditFormErrors({ ...editFormErrors, name: "" });
                      }
                    }}
                    className={`mt-1.5 w-full bg-white ${editFormErrors.name ? "border-red-500" : ""}`}
                  />
                  {editFormErrors.name && (
                    <div className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm text-red-600">{editFormErrors.name}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Evidence requirement")}</Label>
                <Input
                  value={editingEvidence.description || ""}
                  onChange={(e) =>
                    setEditingEvidence({ ...editingEvidence, description: e.target.value })
                  }
                  className="mt-1.5 w-full bg-white"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">
                  {t("Recurrence")} <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={editingEvidence.recurrence || ""}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, recurrence: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  {["Yearly", "Half-yearly", "Quarterly", "Monthly"].map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`edit-${option.toLowerCase()}`} />
                      <Label htmlFor={`edit-${option.toLowerCase()}`} className="text-slate-600">{t(option)}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Entities")}</Label>
                <RadioGroup
                  value={editingEvidence.entities || "Organization Wide"}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, entities: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Organization Wide" id="edit-org-wide" />
                    <Label htmlFor="edit-org-wide" className="text-slate-600">{t("Organization Wide")}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Status")}</Label>
                <RadioGroup
                  value={editingEvidence.status}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, status: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  {["Not Uploaded", "Draft", "Need Attention", "Published", "Validated (For Filters)", "Validated"].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <RadioGroupItem value={status} id={`edit-status-${status.toLowerCase().replace(/\s+/g, "-")}`} />
                      <Label htmlFor={`edit-status-${status.toLowerCase().replace(/\s+/g, "-")}`} className="text-slate-600">{t(status)}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Review date")}
                </Label>

                <DatePicker
                  value={
                    editingEvidence.reviewDate
                      ? new Date(editingEvidence.reviewDate)
                      : undefined
                  }
                  onChange={(date) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      reviewDate: date
                        ? date.toISOString().split("T")[0]
                        : "",
                    })
                  }
                  placeholder={t("Select review date")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Is control linked")}</Label>
                  <RadioGroup
                    value={editingEvidence.isControlLinked ? "Yes" : "No"}
                    onValueChange={(value) =>
                      setEditingEvidence({
                        ...editingEvidence,
                        isControlLinked: value === "Yes",
                      })
                    }
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="edit-control-yes" />
                      <Label htmlFor="edit-control-yes" className="text-slate-600">{t("Yes")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="edit-control-no" />
                      <Label htmlFor="edit-control-no" className="text-slate-600">{t("No")}</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">{t("Is policy linked")}</Label>
                  <RadioGroup
                    value={editingEvidence.isPolicyLinked ? "Yes" : "No"}
                    onValueChange={(value) =>
                      setEditingEvidence({
                        ...editingEvidence,
                        isPolicyLinked: value === "Yes",
                      })
                    }
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="edit-policy-yes" />
                      <Label htmlFor="edit-policy-yes" className="text-slate-600">{t("Yes")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="edit-policy-no" />
                      <Label htmlFor="edit-policy-no" className="text-slate-600">{t("No")}</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Artifact description")}</Label>
                <Input
                  value={editingEvidence.artifactDescription || ""}
                  onChange={(e) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      artifactDescription: e.target.value,
                    })
                  }
                  className="mt-1.5 w-full bg-white"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Is KPI")}</Label>
                <RadioGroup
                  value={editingEvidence.isKPI ? "Yes" : "No"}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, isKPI: value === "Yes" })
                  }
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Yes" id="edit-kpi-yes" />
                    <Label htmlFor="edit-kpi-yes" className="text-slate-600">{t("Yes")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="No" id="edit-kpi-no" />
                    <Label htmlFor="edit-kpi-no" className="text-slate-600">{t("No")}</Label>
                  </div>
                </RadioGroup>
              </div>

              {editingEvidence.isKPI && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI description")}</Label>
                    <Input
                      value={editingEvidence.kpiDescription || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiDescription: e.target.value,
                        })
                      }
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI expected score")}</Label>
                    <Input
                      type="number"
                      value={editingEvidence.kpiExpectedScore || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiExpectedScore: parseInt(e.target.value) || null,
                        })
                      }
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI objective")}</Label>
                    <Input
                      value={editingEvidence.kpiObjective || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiObjective: e.target.value,
                        })
                      }
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI data source")}</Label>
                    <Input
                      value={editingEvidence.kpiDataSource || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiDataSource: e.target.value,
                        })
                      }
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700">{t("KPI calculation formula")}</Label>
                    <Input
                      value={editingEvidence.kpiCalculationFormula || ""}
                      onChange={(e) =>
                        setEditingEvidence({
                          ...editingEvidence,
                          kpiCalculationFormula: e.target.value,
                        })
                      }
                      className="mt-1.5 w-full bg-white"
                    />
                  </div>
                </>
              )}

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Is added")}</Label>
                <RadioGroup
                  value={editingEvidence.isAdded ? "Yes" : "No"}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, isAdded: value === "Yes" })
                  }
                  className="flex gap-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Yes" id="edit-added-yes" />
                    <Label htmlFor="edit-added-yes" className="text-slate-600">{t("Yes")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="No" id="edit-added-no" />
                    <Label htmlFor="edit-added-no" className="text-slate-600">{t("No")}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("AI status")}</Label>
                <RadioGroup
                  value={editingEvidence.aiStatus || ""}
                  onValueChange={(value) =>
                    setEditingEvidence({ ...editingEvidence, aiStatus: value })
                  }
                  className="flex flex-wrap gap-4 mt-2"
                >
                  {["Compliant", "Non Compliant", "Partially Compliant"].map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <RadioGroupItem value={status} id={`edit-ai-${status.toLowerCase().replace(/\s+/g, "-")}`} />
                      <Label htmlFor={`edit-ai-${status.toLowerCase().replace(/\s+/g, "-")}`} className="text-slate-600">{t(status)}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("AI response Justification")}</Label>
                <Input
                  value={editingEvidence.aiJustification || ""}
                  onChange={(e) =>
                    setEditingEvidence({
                      ...editingEvidence,
                      aiJustification: e.target.value,
                    })
                  }
                  className="mt-1.5 w-full bg-white"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Control")}</Label>
                <Select value={editControlId || "_none"} onValueChange={(v) => setEditControlId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1.5 w-full bg-white">
                    <SelectValue placeholder={t("Select control")} />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="_none">{t("No control")}</SelectItem>
                    {translatedControls.map((control) => (
                      <SelectItem key={control.id} value={control.id}>
                        {control.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" onClick={handleEditSave}>{t("Save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-4">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirmation")}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">{t("Are you sure you want to delete this?")}</DialogDescription>
          </div>
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? t("Deleting...") : t("Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="px-4 sm:px-6 py-4">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Confirmation")}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete all")} {evidences.length} {t("evidences?")}
            </DialogDescription>
          </div>
          <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={() => setDeleteAllDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDeleteAll}>
              {t("Delete All")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportName("");
          setImportFile(null);
        }
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-800">{t("Import Evidences")}</DialogTitle>
          </div>
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Name")}</Label>
              <Input
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder={t("Enter name")}
                className="mt-1.5 w-full bg-white"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("File")}</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="mt-1.5 w-full bg-white"
              />
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              {t("Download Template")}
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button size="sm" onClick={handleImportSubmit}>
                <Upload className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                {t("Import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
