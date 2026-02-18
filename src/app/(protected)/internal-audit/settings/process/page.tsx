"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ArrowUpDown, Download, Upload, Search, Activity, CheckCircle, AlertTriangle, XCircle, Home, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePermissions } from "@/hooks/usePermissions";
import { formatLocalDate } from "@/lib/utils";
import { isValidName } from "@/lib/validations";

interface Process {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
  processType: string | null;
  status: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  ownerId: string | null;
  owner: { id: string; fullName: string } | null;
  processFrequency: string | null;
  natureOfImplementation: string | null;
  riskRating: string | null;
  assetDependency: boolean;
  externalDependency: boolean;
  location: string | null;
  kpiMeasurementRequired: boolean;
  piiCapture: boolean;
  operationalComplexity: string | null;
  lastAuditDate: string | null;
  responsibleId: string | null;
  accountableId: string | null;
  consultedId: string | null;
  informedId: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

const PROCESS_FREQUENCIES = [
  "Annually",
  "As needed",
  "Bi-annually",
  "Daily",
  "Monthly",
  "Quarterly",
  "Weekly",
];

const NATURE_OF_IMPLEMENTATIONS = ["Manual", "Automated", "Manual + Automated"];
const OPERATIONAL_COMPLEXITIES = ["Low", "Medium", "High"];
const RISK_RATINGS = ["Low", "Medium", "High"];
const PROCESS_TYPES = ["Primary", "Management", "Supporting"];
const STATUSES = ["Active", "Inactive"];

export default function ProcessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [processes, setProcesses] = useState<Process[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<string>("processCode");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterOwner, setFilterOwner] = useState<string>("");
  const [filterFrequency, setFilterFrequency] = useState<string>("");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Process | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    processType: "Primary",
    status: "Active",
    departmentId: "",
    ownerId: "",
    location: "",
    responsibleId: "",
    accountableId: "",
    consultedId: "",
    informedId: "",
    processFrequency: "",
    natureOfImplementation: "",
    assetDependency: false,
    externalDependency: false,
    kpiMeasurementRequired: false,
    piiCapture: false,
    operationalComplexity: "",
    lastAuditDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [nextProcessId, setNextProcessId] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const TOTAL_STEPS = 3;

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Process | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [processes, searchQuery, filterDepartment, filterOwner, filterFrequency]);

  const fetchData = async () => {
    try {
      const [processesRes, departmentsRes, usersRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);

      if (processesRes.ok) {
        const data = await processesRes.json();
        setProcesses(data);
        // Generate next process ID
        const maxId = data.reduce((max: number, p: Process) => {
          const match = p.processCode?.match(/PRO(\d+)/);
          if (match) {
            return Math.max(max, parseInt(match[1]));
          }
          return max;
        }, 0);
        setNextProcessId(`PRO${maxId + 1}`);
      }

      if (departmentsRes.ok) {
        setDepartments(await departmentsRes.json());
      }

      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...processes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.processCode.toLowerCase().includes(query) ||
          p.name.toLowerCase().includes(query)
      );
    }

    if (filterDepartment) {
      filtered = filtered.filter((p) => p.departmentId === filterDepartment);
    }

    if (filterOwner) {
      filtered = filtered.filter((p) => p.ownerId === filterOwner);
    }

    if (filterFrequency) {
      filtered = filtered.filter((p) => p.processFrequency === filterFrequency);
    }

    setFilteredProcesses(filtered);
  };

  const handleSort = (column: string) => {
    const newOrder = sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortOrder(newOrder);

    const sorted = [...filteredProcesses].sort((a, b) => {
      let aVal: any = a[column as keyof Process];
      let bVal: any = b[column as keyof Process];

      if (column === "department") {
        aVal = a.department?.name || "";
        bVal = b.department?.name || "";
      } else if (column === "owner") {
        aVal = a.owner?.fullName || "";
        bVal = b.owner?.fullName || "";
      }

      if (aVal === null || aVal === undefined) aVal = "";
      if (bVal === null || bVal === undefined) bVal = "";

      if (typeof aVal === "string") {
        return newOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return newOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    setFilteredProcesses(sorted);
  };

  // Calculate summary stats
  const getStats = () => {
    const notAssessed = processes.filter((p) => !p.riskRating).length;
    const low = processes.filter((p) => p.riskRating === "Low").length;
    const medium = processes.filter((p) => p.riskRating === "Medium").length;
    const high = processes.filter((p) => p.riskRating === "High").length;
    return { notAssessed, low, medium, high };
  };

  const stats = getStats();

  const openAddDialog = () => {
    setEditItem(null);
    setCurrentStep(1);
    setFormData({
      name: "",
      description: "",
      processType: "Primary",
      status: "Active",
      departmentId: "",
      ownerId: "",
      location: "",
      responsibleId: "",
      accountableId: "",
      consultedId: "",
      informedId: "",
      processFrequency: "",
      natureOfImplementation: "",
      assetDependency: false,
      externalDependency: false,
      kpiMeasurementRequired: false,
      piiCapture: false,
      operationalComplexity: "",
      lastAuditDate: "",
    });
    setUploadedFiles([]);
    setFormErrors({});

    // Recalculate next process ID to ensure it's current
    const maxId = processes.reduce((max: number, p: Process) => {
      const match = p.processCode?.match(/PRO(\d+)/);
      if (match) {
        return Math.max(max, parseInt(match[1]));
      }
      return max;
    }, 0);
    setNextProcessId(`PRO${maxId + 1}`);

    setDialogOpen(true);
  };

  const openEditDialog = (process: Process) => {
    setEditItem(process);
    setCurrentStep(1);
    setFormData({
      name: process.name || "",
      description: process.description || "",
      processType: process.processType || "Primary",
      status: process.status || "Active",
      departmentId: process.departmentId || "",
      ownerId: process.ownerId || "",
      location: process.location || "",
      responsibleId: process.responsibleId || "",
      accountableId: process.accountableId || "",
      consultedId: process.consultedId || "",
      informedId: process.informedId || "",
      processFrequency: process.processFrequency || "",
      natureOfImplementation: process.natureOfImplementation || "",
      assetDependency: process.assetDependency || false,
      externalDependency: process.externalDependency || false,
      kpiMeasurementRequired: process.kpiMeasurementRequired || false,
      piiCapture: process.piiCapture || false,
      operationalComplexity: process.operationalComplexity || "",
      lastAuditDate: process.lastAuditDate
        ? formatLocalDate(new Date(process.lastAuditDate))
        : "",
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = t("Process Name is required");
    } else if (!isValidName(formData.name)) {
      errors.name = t("Only letters, spaces, and hyphens are allowed");
    }
    if (!formData.ownerId) errors.ownerId = t("Process Owner is required");
    if (!formData.processFrequency) errors.processFrequency = t("Process Frequency is required");
    if (!formData.natureOfImplementation) errors.natureOfImplementation = t("Nature of Implementation is required");
    if (!formData.operationalComplexity) errors.operationalComplexity = t("Operational Complexity is required");
    if (!formData.lastAuditDate) errors.lastAuditDate = t("Last Audit Date is required");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentStep(1);
    setFormErrors({});
  };

  const handleSave = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }

    setSaving(true);
    try {
      const url = editItem ? `/api/processes/${editItem.id}` : "/api/processes";
      const method = editItem ? "PUT" : "POST";

      const body = {
        ...formData,
        // Include processCode only when creating new process
        ...(editItem ? {} : { processCode: nextProcessId }),
        departmentId: formData.departmentId || null,
        ownerId: formData.ownerId || null,
        lastAuditDate: formData.lastAuditDate || null,
        responsibleId: formData.responsibleId || null,
        accountableId: formData.accountableId || null,
        consultedId: formData.consultedId || null,
        informedId: formData.informedId || null,
      };

      console.log("Saving process:", body);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({ title: t("Success"), description: t("Process saved successfully!") });
        setDialogOpen(false);
        setCurrentStep(1);
        setUploadedFiles([]);
        fetchData();
      } else {
        const errorData = await response.json();
        console.error("Error response:", errorData);
        toast({ title: t("Error"), description: `${t("Failed to save process")}: ${errorData.error || t("Unknown error")}`, variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: t("Error"), description: t("An error occurred while saving the process"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return t("Basic Information");
      case 2: return t("Add Documents");
      case 3: return t("RACI Assignment");
      default: return "";
    }
  };

  const openDeleteDialog = (process: Process) => {
    setItemToDelete(process);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/processes/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExport = () => {
    const headers = [
      "Process Code",
      "Name",
      "Description",
      "Process Type",
      "Status",
      "Department",
      "Owner",
      "Process Frequency",
      "Nature of Implementation",
      "Asset Dependency",
      "External Dependency",
      "KPI Measurement Required",
      "PII Capture",
      "Operational Complexity",
      "Last Audit Date",
    ];

    const csvContent = [
      headers.join(","),
      ...processes.map((process) =>
        [
          process.processCode,
          `"${process.name}"`,
          `"${process.description || ""}"`,
          process.processType || "",
          process.status || "",
          `"${process.department?.name || ""}"`,
          `"${process.owner?.fullName || ""}"`,
          process.processFrequency || "",
          process.natureOfImplementation || "",
          process.assetDependency ? "Yes" : "No",
          process.externalDependency ? "Yes" : "No",
          process.kpiMeasurementRequired ? "Yes" : "No",
          process.piiCapture ? "Yes" : "No",
          process.operationalComplexity || "",
          process.lastAuditDate
            ? new Date(process.lastAuditDate).toLocaleDateString()
            : "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `processes-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target?.result as string;
      const lines = csv.split("\n");
      const headers = lines[0].split(",");

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const processData: any = {};

        headers.forEach((header, index) => {
          const value = values[index]?.replace(/^"|"$/g, "").trim();
          if (header.includes("Name")) processData.name = value;
          if (header.includes("Description")) processData.description = value;
          if (header.includes("Process Type")) processData.processType = value;
          if (header.includes("Status")) processData.status = value;
          if (header.includes("Process Frequency"))
            processData.processFrequency = value;
          if (header.includes("Nature of Implementation"))
            processData.natureOfImplementation = value;
          if (header.includes("Asset Dependency"))
            processData.assetDependency = value === "Yes";
          if (header.includes("External Dependency"))
            processData.externalDependency = value === "Yes";
          if (header.includes("KPI Measurement Required"))
            processData.kpiMeasurementRequired = value === "Yes";
          if (header.includes("PII Capture"))
            processData.piiCapture = value === "Yes";
          if (header.includes("Operational Complexity"))
            processData.operationalComplexity = value;
        });

        if (processData.name) {
          try {
            await fetch("/api/processes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(processData),
            });
          } catch (error) {
            console.error("Failed to import process:", error);
          }
        }
      }

      fetchData();
      e.target.value = "";
    };

    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          {canViewDashboard && (
            <>
              <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
                {t("Dashboard")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            </>
          )}
          <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Settings")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-primary-700 font-medium">{t("Process")}</span>
        </nav>

        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Process")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading processes...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        {canViewDashboard && (
          <>
            <Link href="/internal-audit/dashboard" className="text-slate-500 hover:text-primary-600 transition-colors">
              {t("Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <Link href="/internal-audit/settings" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Settings")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Process")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("Process")}</h1>
      </div>

      {/* Content */}
      <div className="space-y-4 sm:space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-800">
              {stats.notAssessed}
            </div>
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-500">{t("Not Assessed")}</span>
            </div>
          </div>

          <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-800">
              {stats.low}
            </div>
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-500">{t("Low")}</span>
            </div>
          </div>

          <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-800">
              {stats.medium}
            </div>
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-500">{t("Medium")}</span>
            </div>
          </div>

          <div className="relative flex flex-col p-5 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-slate-800">
              {stats.high}
            </div>
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-500">{t("High")}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Upload className="h-4 w-4 mr-2" />
            {t("Export")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById('import-file')?.click()}>
            <Download className="h-4 w-4 mr-2" />
            {t("Import")}
          </Button>
          <input
            id="import-file"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImport}
          />
          <Button size="sm" className="col-span-2 sm:col-span-1" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t("New Process")}
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 px-3 sm:px-5 py-3 border-b border-slate-100">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t("Search By Process ID, Name")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-[250px] h-9 bg-slate-50 border-slate-200"
              />
            </div>

            <Select value={filterDepartment || "all"} onValueChange={(v) => setFilterDepartment(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Department")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Departments")}</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterOwner || "all"} onValueChange={(v) => setFilterOwner(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Process Owner")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Owners")}</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterFrequency || "all"} onValueChange={(v) => setFilterFrequency(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Process Frequency")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Frequencies")}</SelectItem>
                {PROCESS_FREQUENCIES.map((freq) => (
                  <SelectItem key={freq} value={freq}>
                    {freq}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Reference ID")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Name")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Process Owner")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Frequency")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Implementation")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Risk Rating")}</TableHead>
                <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5 w-[100px]">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProcesses.map((process) => (
                <TableRow key={process.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 text-sm text-slate-600 pl-5">{process.processCode}</TableCell>
                  <TableCell className="py-3 text-sm font-medium text-slate-800">{process.name}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{process.department?.name || ""}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{process.owner?.fullName || ""}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{process.processFrequency || ""}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-600">{process.natureOfImplementation || ""}</TableCell>
                  <TableCell className="py-3">
                    {process.riskRating && (
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          process.riskRating === "High"
                            ? "bg-red-100 text-red-700"
                            : process.riskRating === "Medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {process.riskRating}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(process)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(process)}
                        title={t("Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProcesses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-sm text-slate-500">
                    {t("No processes found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {/* Pagination info */}
          <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              {t("Showing")} {filteredProcesses.length} {t("of")} {processes.length} {t("processes")}
            </span>
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">{editItem ? t("Edit Process") : t("New Process")}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center mt-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-medium ${
                    step === currentStep
                      ? "bg-primary text-primary-foreground border-primary"
                      : step < currentStep
                      ? "bg-primary/20 border-primary text-primary"
                      : "border-slate-300 text-slate-400"
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-0.5 ${step < currentStep ? "bg-primary" : "bg-slate-200"}`} />
                  )}
                </div>
              ))}
            </div>
            <p className="text-center mt-2 text-sm font-medium text-slate-600">{getStepTitle()}</p>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="space-y-5">{currentStep === 1 && (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Process ID (readonly) */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Process ID")}</Label>
                <Input
                  value={editItem ? editItem.processCode : nextProcessId}
                  disabled
                  className="mt-1.5 w-full bg-slate-50"
                />
              </div>

              {/* Process Name */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Process Name")} <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setFormErrors({ ...formErrors, name: "" });
                  }}
                  placeholder={t("Enter Process Name")}
                  className={`mt-1.5 w-full bg-white ${formErrors.name ? "border-red-500" : ""}`}
                />
                {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium text-slate-700">{t("Description")}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter Description")}
                className="mt-1.5 w-full bg-white"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Department */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Department")}</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
                    <SelectValue placeholder={t("Select Department")} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Process Owner */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Process Owner")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.ownerId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, ownerId: value });
                    setFormErrors({ ...formErrors, ownerId: "" });
                  }}
                >
                  <SelectTrigger className={`mt-1.5 w-full bg-white border-slate-200 ${formErrors.ownerId ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={t("Select Owner")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.ownerId && <p className="text-sm text-red-500 mt-1">{formErrors.ownerId}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Process Frequency */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Process Frequency")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.processFrequency}
                  onValueChange={(value) => { setFormData({ ...formData, processFrequency: value }); setFormErrors(prev => ({ ...prev, processFrequency: "" })); }}
                >
                  <SelectTrigger className={`mt-1.5 w-full bg-white border-slate-200 ${formErrors.processFrequency ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={t("Select Process Frequency")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCESS_FREQUENCIES.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {freq}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.processFrequency && <p className="text-sm text-red-500 mt-1">{formErrors.processFrequency}</p>}
              </div>

              {/* Nature of Implementation */}
              <div>
                <Label className="text-sm font-medium text-slate-700">{t("Nature of Implementation")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.natureOfImplementation}
                  onValueChange={(value) => { setFormData({ ...formData, natureOfImplementation: value }); setFormErrors(prev => ({ ...prev, natureOfImplementation: "" })); }}
                >
                  <SelectTrigger className={`mt-1.5 w-full bg-white border-slate-200 ${formErrors.natureOfImplementation ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={t("Select Nature Of Implementation")} />
                  </SelectTrigger>
                  <SelectContent>
                    {NATURE_OF_IMPLEMENTATIONS.map((nature) => (
                      <SelectItem key={nature} value={nature}>
                        {nature}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.natureOfImplementation && <p className="text-sm text-red-500 mt-1">{formErrors.natureOfImplementation}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Asset Dependency */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="assetDependency"
                  checked={formData.assetDependency}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, assetDependency: checked as boolean })
                  }
                />
                <Label htmlFor="assetDependency" className="cursor-pointer">
                  {t("Asset Dependency")}
                </Label>
              </div>

              {/* External Dependency */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="externalDependency"
                  checked={formData.externalDependency}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, externalDependency: checked as boolean })
                  }
                />
                <Label htmlFor="externalDependency" className="cursor-pointer">
                  {t("External Dependency")}
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* KPI Measurement Required */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpiMeasurementRequired"
                  checked={formData.kpiMeasurementRequired}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, kpiMeasurementRequired: checked as boolean })
                  }
                />
                <Label htmlFor="kpiMeasurementRequired" className="cursor-pointer">
                  {t("KPI Measurement Required")}
                </Label>
              </div>

              {/* PII Capture */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="piiCapture"
                  checked={formData.piiCapture}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, piiCapture: checked as boolean })
                  }
                />
                <Label htmlFor="piiCapture" className="cursor-pointer">
                  {t("PII Capture")}
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Operational Complexity */}
              <div>
                <Label>{t("Operational Complexity")} <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.operationalComplexity}
                  onValueChange={(value) => {
                    setFormData({ ...formData, operationalComplexity: value });
                    setFormErrors({ ...formErrors, operationalComplexity: "" });
                  }}
                >
                  <SelectTrigger className={`mt-1.5 w-full bg-white border-slate-200 ${formErrors.operationalComplexity ? "border-red-500" : ""}`}>
                    <SelectValue placeholder={t("Select Complexity")} />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATIONAL_COMPLEXITIES.map((complexity) => (
                      <SelectItem key={complexity} value={complexity}>
                        {complexity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.operationalComplexity && <p className="text-sm text-red-500 mt-1">{formErrors.operationalComplexity}</p>}
              </div>

              {/* Last Audit Date */}
              <div>
                <Label htmlFor="lastAuditDate">{t("Last Audit Date")} <span className="text-red-500">*</span></Label>
                <DatePicker
                  value={formData.lastAuditDate}
                  onChange={(date) => {
                    setFormData({ ...formData, lastAuditDate: date ? formatLocalDate(date) : "" });
                    setFormErrors({ ...formErrors, lastAuditDate: "" });
                  }}
                  placeholder={t("Select date")}
                  className={`mt-1.5 ${formErrors.lastAuditDate ? "border-red-500" : ""}`}
                />
                {formErrors.lastAuditDate && <p className="text-sm text-red-500 mt-1">{formErrors.lastAuditDate}</p>}
              </div>
            </div>
            </>
            )}

            {/* Step 2: Add Documents */}
            {currentStep === 2 && (
            <>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById('fileUpload')?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-primary');
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-primary');
                const files = Array.from(e.dataTransfer.files);
                const validFiles = files.filter(f =>
                  ['.pdf', '.doc', '.docx', '.xls', '.xlsx'].some(ext => f.name.toLowerCase().endsWith(ext)) &&
                  f.size <= 10 * 1024 * 1024
                );
                setUploadedFiles(prev => [...prev, ...validFiles]);
              }}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="text-gray-400">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {t("Drag and drop files here, or click to browse")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t("Support for PDF, DOC, DOCX, XLS, XLSX (Max 10MB)")}
                  </p>
                </div>
                <Input
                  type="file"
                  multiple
                  className="hidden"
                  id="fileUpload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024);
                    setUploadedFiles(prev => [...prev, ...validFiles]);
                  }}
                />
              </div>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">{t("Uploaded Files")} ({uploadedFiles.length}):</p>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm text-gray-600 truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm text-gray-500 mt-2">
              {t("You can upload multiple documents related to this process")}
            </div>
            </>
            )}

            {/* Step 3: RACI Assignment */}
            {currentStep === 3 && (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Responsible */}
              <div>
                <Label>{t("Responsible")}</Label>
                <Select
                  value={formData.responsibleId}
                  onValueChange={(value) => setFormData({ ...formData, responsibleId: value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
                    <SelectValue placeholder={t("Select Responsible")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accountable */}
              <div>
                <Label>{t("Accountable")}</Label>
                <Select
                  value={formData.accountableId}
                  onValueChange={(value) => setFormData({ ...formData, accountableId: value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
                    <SelectValue placeholder={t("Select Accountable")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Consulted */}
              <div>
                <Label>{t("Consulted")}</Label>
                <Select
                  value={formData.consultedId}
                  onValueChange={(value) => setFormData({ ...formData, consultedId: value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
                    <SelectValue placeholder={t("Select Consulted")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Informed */}
              <div>
                <Label>{t("Informed")}</Label>
                <Select
                  value={formData.informedId}
                  onValueChange={(value) => setFormData({ ...formData, informedId: value })}
                >
                  <SelectTrigger className="mt-1.5 w-full bg-white border-slate-200">
                    <SelectValue placeholder={t("Select Informed")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            </>
            )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <span className="text-xs font-medium text-slate-400 me-auto">
              {t("Step")} {currentStep} {t("of")} {TOTAL_STEPS}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                if (currentStep === 1) {
                  handleCloseDialog();
                } else {
                  handlePrevious();
                }
              }}
            >
              {currentStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
              {currentStep === 1 ? t("Cancel") : t("Previous")}
            </Button>
            {currentStep < TOTAL_STEPS ? (
              <Button onClick={handleNext}>
                {t("Next")}
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("Saving...") : t("Save")}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-[400px] p-0 gap-0">
          <AlertDialogHeader className="px-6 py-5 border-b border-slate-100">
            <AlertDialogTitle className="text-lg font-semibold text-slate-800">{t("Confirm Delete")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate-500 mt-1">
              {t("Are you sure you want to delete this process? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
