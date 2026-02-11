"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Home,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";

interface Department {
  id: string;
  name: string;
}

interface Risk {
  id: string;
  riskId: string;
  riskName: string;
  riskLevel: string | null;
}

interface User {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AuditType {
  id: string;
  name: string;
}

interface ScoringRange {
  id: string;
  label: string;
}

interface Engagement {
  id: string;
  auditId: string;
  engagementTitle: string;
  department: Department | null;
  auditType: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  assignedAuditors: string[];
}

interface AuditTask {
  id: string;
  task: string;
  done: boolean;
  plannedHours: string;
  actualHours: string;
  auditorId: string;
  comments: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface Process {
  id: string;
  name: string;
}

interface EngagementFormData {
  engagementTitle: string;
  engagementObjective: string;
  engagementScope: string;
  departmentId: string;
  linkedRiskIds: string[];
  auditRating: string;
  auditType: string;
  auditorId: string;
  auditeeId: string;
  processId: string;
  startDate: string;
  targetDate: string;
  initialObservation: string;
  relatedPolicies: string;
}

const defaultTasks: AuditTask[] = [
  { id: "1", task: "Audit Preparation & Update", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "2", task: "Documentation Review", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "3", task: "Sample Selection", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "4", task: "Result of Previous Audit", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "5", task: "Related Policies", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
  { id: "6", task: "Related Procedures", done: false, plannedHours: "", actualHours: "", auditorId: "", comments: "" },
];

const emptyFormData: EngagementFormData = {
  engagementTitle: "",
  engagementObjective: "",
  engagementScope: "",
  departmentId: "",
  linkedRiskIds: [],
  auditRating: "",
  auditType: "",
  auditorId: "",
  auditeeId: "",
  processId: "",
  startDate: "",
  targetDate: "",
  initialObservation: "",
  relatedPolicies: "",
};

export default function AuditPlanningPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { canView: canViewDashboard } = usePermissions('audit.dashboard');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchFilter, setSearchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Engagement | null>(null);

  // Report generation dialog
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFilterType, setReportFilterType] = useState("");
  const [reportYear, setReportYear] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

  // Report preview modal
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  const [reportStats, setReportStats] = useState({ riskCount: 0, findingCount: 0, auditHeadName: '' });
  const [loadingStats, setLoadingStats] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Add/Edit Engagement dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEngagementId, setEditingEngagementId] = useState<string | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [historicalRisks, setHistoricalRisks] = useState<Risk[]>([]);
  const [auditors, setAuditors] = useState<User[]>([]);
  const [auditees, setAuditees] = useState<User[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [auditRatings, setAuditRatings] = useState<ScoringRange[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [saving, setSaving] = useState(false);
  const [engagementForm, setEngagementForm] = useState<EngagementFormData>(emptyFormData);
  const [tasks, setTasks] = useState<AuditTask[]>([...defaultTasks]);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // File uploads
  const attachFileRef = useRef<HTMLInputElement>(null);
  const workpaperRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [workpaperFiles, setWorkpaperFiles] = useState<UploadedFile[]>([]);
  const [isDragOverAttach, setIsDragOverAttach] = useState(false);
  const [isDragOverWorkpaper, setIsDragOverWorkpaper] = useState(false);

  const isAuditHead = session?.user?.roles?.includes("AuditHead");

  useEffect(() => {
    fetchDepartments();
    fetchEngagements();
    fetchAvailableYears();
  }, []);

  useEffect(() => {
    fetchEngagements();
  }, [departmentFilter, statusFilter, yearFilter, searchFilter]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };

  const fetchAvailableYears = async () => {
    try {
      const response = await fetch("/api/internal-audit/engagements/years");
      if (response.ok) {
        const data = await response.json();
        setAvailableYears(data);
      }
    } catch (error) {
      console.error("Failed to fetch available years:", error);
    }
  };

  const fetchEngagements = async () => {
    try {
      const params = new URLSearchParams();
      if (departmentFilter && departmentFilter !== "all") params.append("departmentId", departmentFilter);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (yearFilter && yearFilter !== "all") params.append("year", yearFilter);
      if (searchFilter) params.append("search", searchFilter);

      const response = await fetch(`/api/internal-audit/engagements?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setEngagements(data);
      }
    } catch (error) {
      console.error("Failed to fetch engagements:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRisksForDepartment = async (departmentId: string) => {
    try {
      const response = await fetch(`/api/internal-audit/risks?departmentId=${departmentId}&status=Open`);
      if (response.ok) {
        const data = await response.json();
        setRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch risks:", error);
    }
  };

  const fetchHistoricalRisks = async (departmentId: string) => {
    try {
      const lastYear = new Date().getFullYear() - 1;
      const response = await fetch(`/api/internal-audit/risks?departmentId=${departmentId}&year=${lastYear}`);
      if (response.ok) {
        const data = await response.json();
        setHistoricalRisks(data);
      }
    } catch (error) {
      console.error("Failed to fetch historical risks:", error);
    }
  };

  const fetchAuditorsAndAuditees = async () => {
    try {
      const [auditeesRes, auditorsRes, auditTypesRes, scoringRangesRes, processesRes] = await Promise.all([
        fetch("/api/internal-audit/users?role=Auditee"),
        fetch("/api/internal-audit/users?role=auditors"),
        fetch("/api/internal-audit/audit-types"),
        fetch("/api/internal-audit/scoring-ranges"),
        fetch("/api/internal-audit/processes"),
      ]);

      if (auditeesRes.ok) {
        const auditeesData = await auditeesRes.json();
        setAuditees(auditeesData.users || auditeesData || []);
      }
      if (auditorsRes.ok) {
        const auditorsData = await auditorsRes.json();
        setAuditors(auditorsData.users || auditorsData || []);
      }
      if (auditTypesRes.ok) {
        const auditTypesData = await auditTypesRes.json();
        setAuditTypes(auditTypesData || []);
      }
      if (scoringRangesRes.ok) {
        const scoringRangesData = await scoringRangesRes.json();
        // Get unique labels from scoring ranges for audit ratings
        const uniqueLabels = [...new Set<string>(scoringRangesData.map((r: ScoringRange) => r.label))];
        setAuditRatings(uniqueLabels.map((label) => ({ id: label, label })));
      }
      if (processesRes.ok) {
        const processesData = await processesRes.json();
        setProcesses(processesData || []);
      }
    } catch (error) {
      console.error("Failed to fetch auditors/auditees:", error);
    }
  };

  const resetFormState = () => {
    setEngagementForm(emptyFormData);
    setTasks([...defaultTasks]);
    setRisks([]);
    setHistoricalRisks([]);
    setAttachedFiles([]);
    setWorkpaperFiles([]);
    setValidationErrors({});
  };

  const openAddDialog = async () => {
    resetFormState();
    setAddDialogOpen(true);
    setDialogLoading(true);
    await fetchAuditorsAndAuditees();
    setDialogLoading(false);
  };

  const openEditDialog = async (engagement: Engagement) => {
    resetFormState();
    setEditingEngagementId(engagement.id);
    setEditDialogOpen(true);
    setDialogLoading(true);

    try {
      await fetchAuditorsAndAuditees();

      const response = await fetch(`/api/internal-audit/engagements/${engagement.id}`);
      if (response.ok) {
        const data = await response.json();
        setEngagementForm({
          engagementTitle: data.engagementTitle || "",
          engagementObjective: data.engagementObjective || "",
          engagementScope: data.engagementScope || "",
          departmentId: data.departmentId || "",
          linkedRiskIds: data.linkedRiskIds || [],
          auditRating: data.auditRating || "",
          auditType: data.auditType || "",
          auditorId: data.assignedAuditorId || "",
          auditeeId: data.auditeeId || "",
          processId: data.processId || "",
          startDate: data.plannedStartDate ? data.plannedStartDate.split("T")[0] : "",
          targetDate: data.plannedEndDate ? data.plannedEndDate.split("T")[0] : "",
          initialObservation: data.initialObservation || "",
          relatedPolicies: data.relatedPolicies || "",
        });

        // Fetch risks for the department
        if (data.departmentId) {
          await fetchRisksForDepartment(data.departmentId);
          await fetchHistoricalRisks(data.departmentId);
        }
      } else {
        toast.error(t("Failed to load engagement"));
        setEditDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to fetch engagement:", error);
      toast.error(t("Failed to load engagement"));
      setEditDialogOpen(false);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleEngagementDepartmentChange = async (departmentId: string) => {
    setEngagementForm({ ...engagementForm, departmentId, linkedRiskIds: [] });
    if (departmentId) {
      await fetchRisksForDepartment(departmentId);
      await fetchHistoricalRisks(departmentId);
    } else {
      setRisks([]);
      setHistoricalRisks([]);
    }
  };

  // File upload handlers
  const handleFileDrop = async (e: React.DragEvent, type: "attach" | "workpaper") => {
    e.preventDefault();
    if (type === "attach") setIsDragOverAttach(false);
    else setIsDragOverWorkpaper(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files, type);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: "attach" | "workpaper") => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(files, type);
    e.target.value = "";
  };

  const uploadFiles = async (files: File[], type: "attach" | "workpaper") => {
    for (const file of files) {
      const newFile: UploadedFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
      };

      if (type === "attach") {
        setAttachedFiles((prev) => [...prev, newFile]);
      } else {
        setWorkpaperFiles((prev) => [...prev, newFile]);
      }
    }
  };

  const removeFile = (fileId: string, type: "attach" | "workpaper") => {
    if (type === "attach") {
      setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
    } else {
      setWorkpaperFiles((prev) => prev.filter((f) => f.id !== fileId));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Task handlers
  const addTaskRow = () => {
    const newTask: AuditTask = {
      id: Date.now().toString(),
      task: "",
      done: false,
      plannedHours: "",
      actualHours: "",
      auditorId: "",
      comments: "",
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, field: keyof AuditTask, value: string | boolean) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const removeTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const calculateTotalHours = (field: "plannedHours" | "actualHours") => {
    return tasks.reduce((sum, task) => sum + (parseFloat(task[field]) || 0), 0);
  };

  const validateEngagementForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!engagementForm.engagementTitle.trim()) {
      errors.engagementTitle = t("Engagement Title is required") || "Engagement Title is required";
    }
    if (!engagementForm.engagementObjective.trim()) {
      errors.engagementObjective = t("Engagement Objective is required") || "Engagement Objective is required";
    }
    if (!engagementForm.engagementScope.trim()) {
      errors.engagementScope = t("Engagement Scope is required") || "Engagement Scope is required";
    }
    if (!engagementForm.departmentId) {
      errors.departmentId = t("Department is required") || "Department is required";
    }
    if (!engagementForm.auditorId) {
      errors.auditorId = t("Auditor is required") || "Auditor is required";
    }
    if (!engagementForm.startDate) {
      errors.startDate = t("Start Date is required") || "Start Date is required";
    }
    if (!engagementForm.targetDate) {
      errors.targetDate = t("Target Date is required") || "Target Date is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveEngagement = async () => {
    if (!validateEngagementForm()) return;

    setSaving(true);
    try {
      const response = await fetch("/api/internal-audit/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...engagementForm,
          tasks,
          plannedHours: calculateTotalHours("plannedHours"),
        }),
      });

      if (response.ok) {
        toast.success(t("Engagement created successfully"));
        setAddDialogOpen(false);
        resetFormState();
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to create engagement"));
      }
    } catch (error) {
      console.error("Failed to create engagement:", error);
      toast.error(t("Failed to create engagement"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEngagement = async () => {
    if (!validateEngagementForm() || !editingEngagementId) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/internal-audit/engagements/${editingEngagementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...engagementForm,
          tasks,
          plannedHours: calculateTotalHours("plannedHours"),
        }),
      });

      if (response.ok) {
        toast.success(t("Engagement updated successfully"));
        setEditDialogOpen(false);
        setEditingEngagementId(null);
        resetFormState();
        fetchEngagements();
      } else {
        const error = await response.json();
        toast.error(error.error || t("Failed to update engagement"));
      }
    } catch (error) {
      console.error("Failed to update engagement:", error);
      toast.error(t("Failed to update engagement"));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (item: Engagement) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/internal-audit/engagements/${itemToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success(t("Engagement deleted successfully"));
        fetchEngagements();
      } else {
        toast.error(t("Failed to delete engagement"));
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error(t("Failed to delete engagement"));
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const headers = ["Audit ID", "Engagement Title", "Department", "Audit Type", "Assigned Auditors", "Status"];
      const rows = engagements.map(e => [
        e.auditId,
        e.engagementTitle,
        e.department?.name || "",
        e.auditType || "",
        e.assignedAuditors.join("; "),
        e.status
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-plan-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(t("Export completed"));
    } catch (error) {
      toast.error(t("Failed to export"));
    }
  };

  const openReportDialog = () => {
    setReportFilterType("");
    setReportYear("");
    setReportStartDate("");
    setReportEndDate("");
    setReportDialogOpen(true);
  };

  const handleShowReport = async () => {
    if (!reportFilterType) {
      toast.error(t("Please select a filter type"));
      return;
    }
    if (reportFilterType === "Year" && !reportYear) {
      toast.error(t("Please select a year"));
      return;
    }
    if (reportFilterType === "DateRange") {
      if (!reportStartDate) {
        toast.error(t("Please select a start date"));
        return;
      }
      if (!reportEndDate) {
        toast.error(t("Please select an end date"));
        return;
      }
      if (new Date(reportStartDate) > new Date(reportEndDate)) {
        toast.error(t("Start date cannot be after end date"));
        return;
      }
    }

    setReportDialogOpen(false);
    setLoadingStats(true);
    setReportPreviewOpen(true);

    // Fetch report stats
    try {
      let url = `/api/internal-audit/audit-plan/stats?`;
      if (reportFilterType === "DateRange") {
        url += `filterType=DateRange&startDate=${reportStartDate}&endDate=${reportEndDate}`;
      } else {
        url += `year=${reportYear}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReportStats({ riskCount: data.riskCount, findingCount: data.findingCount, auditHeadName: data.auditHeadName || '' });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      let url = `/api/internal-audit/audit-plan/download?`;
      let filename = "";
      if (reportFilterType === "DateRange" && reportStartDate && reportEndDate) {
        url += `filterType=DateRange&startDate=${reportStartDate}&endDate=${reportEndDate}`;
        filename = `Annual_Audit_Plan_${reportStartDate}_to_${reportEndDate}.pdf`;
      } else {
        url += `year=${reportYear}`;
        filename = `Annual_Audit_Plan_${reportYear}.pdf`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
        toast.success(t("Report downloaded successfully"));
      } else {
        toast.error(t("Failed to download report"));
      }
    } catch (error) {
      console.error("Failed to download report:", error);
      toast.error(t("Failed to download report"));
    } finally {
      setDownloadingReport(false);
    }
  };

  // Render the engagement form content (shared between Add and Edit dialogs)
  const renderEngagementFormContent = () => (
    <div className="space-y-5">
      {/* Engagement Title */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Engagement Title")} <span className="text-red-500">*</span>
        </Label>
        <Input
          value={engagementForm.engagementTitle}
          onChange={(e) => setEngagementForm({ ...engagementForm, engagementTitle: e.target.value })}
          placeholder={t("Enter engagement title")}
          className={`w-full bg-white ${validationErrors.engagementTitle ? 'border-red-500' : ''}`}
        />
        {validationErrors.engagementTitle && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.engagementTitle}</p>
        )}
      </div>

      {/* Engagement Objective */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Engagement Objective")} <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={engagementForm.engagementObjective}
          onChange={(e) => setEngagementForm({ ...engagementForm, engagementObjective: e.target.value })}
          placeholder={t("Enter engagement objective")}
          rows={3}
          className={`w-full bg-white resize-none ${validationErrors.engagementObjective ? 'border-red-500' : ''}`}
        />
        {validationErrors.engagementObjective && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.engagementObjective}</p>
        )}
      </div>

      {/* Engagement Scope */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Engagement Scope")} <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={engagementForm.engagementScope}
          onChange={(e) => setEngagementForm({ ...engagementForm, engagementScope: e.target.value })}
          placeholder={t("Enter engagement scope")}
          rows={3}
          className={`w-full bg-white resize-none ${validationErrors.engagementScope ? 'border-red-500' : ''}`}
        />
        {validationErrors.engagementScope && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.engagementScope}</p>
        )}
      </div>

      {/* Department */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Department")} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={engagementForm.departmentId}
          onValueChange={handleEngagementDepartmentChange}
        >
          <SelectTrigger className={`w-full bg-white ${validationErrors.departmentId ? 'border-red-500' : ''}`}>
            <SelectValue placeholder={t("Select department")} />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {validationErrors.departmentId && (
          <p className="text-sm text-red-600 mt-1">{validationErrors.departmentId}</p>
        )}
      </div>

      {/* Link Open Risks */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Link Open Risks in this Department")}
        </Label>
        <Select
          value={engagementForm.linkedRiskIds[0] || ""}
          onValueChange={(value) => setEngagementForm({ ...engagementForm, linkedRiskIds: value ? [value] : [] })}
        >
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder={t("Select risk")} />
          </SelectTrigger>
          <SelectContent>
            {risks.length > 0 ? (
              risks.map((risk) => (
                <SelectItem key={risk.id} value={risk.id}>
                  {risk.riskId} - {risk.riskName}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                {engagementForm.departmentId ? t("No open risks found") : t("Select a department first")}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Historical Risks */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Historical Risks (For reference, last year)")}</Label>
        <div className="border border-slate-200 rounded-xl px-4 py-3 min-h-[60px] bg-slate-50/50">
          {historicalRisks.length > 0 ? (
            <ul className="space-y-2">
              {historicalRisks.map((risk) => (
                <li key={risk.id} className="text-sm text-slate-600 flex items-start gap-2">
                  <span className="text-slate-400 mt-0.5">•</span>
                  <span className="flex-1">{risk.riskId} - {risk.riskName} ({risk.riskLevel || t("N/A")})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center text-sm py-2">{t("No items found")}</p>
          )}
        </div>
      </div>

      {/* Process */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Process")}</Label>
        <Select
          value={engagementForm.processId}
          onValueChange={(value) => setEngagementForm({ ...engagementForm, processId: value })}
        >
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder={t("Select Process")} />
          </SelectTrigger>
          <SelectContent>
            {processes.length > 0 ? (
              processes.map((process) => (
                <SelectItem key={process.id} value={process.id}>
                  {process.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                {t("No processes available")}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Two columns for Audit Rating and Audit Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">{t("Audit Rating")}</Label>
          <Select
            value={engagementForm.auditRating}
            onValueChange={(value) => setEngagementForm({ ...engagementForm, auditRating: value })}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder={t("Select rating")} />
            </SelectTrigger>
            <SelectContent>
              {auditRatings.length > 0 ? (
                auditRatings.map((rating) => (
                  <SelectItem key={rating.id} value={rating.label}>
                    {rating.label}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No ratings configured")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">{t("Audit Type")}</Label>
          <Select
            value={engagementForm.auditType}
            onValueChange={(value) => setEngagementForm({ ...engagementForm, auditType: value })}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder={t("Select type")} />
            </SelectTrigger>
            <SelectContent>
              {auditTypes.length > 0 ? (
                auditTypes.map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No audit types configured")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Two columns for Auditor and Auditee */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">
            {t("Auditor")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={engagementForm.auditorId}
            onValueChange={(value) => setEngagementForm({ ...engagementForm, auditorId: value })}
          >
            <SelectTrigger className={`w-full bg-white ${validationErrors.auditorId ? 'border-red-500' : ''}`}>
              <SelectValue placeholder={t("Select auditor")} />
            </SelectTrigger>
            <SelectContent>
              {auditors.length > 0 ? (
                auditors.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No auditors available")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {validationErrors.auditorId && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.auditorId}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">{t("Auditee")}</Label>
          <Select
            value={engagementForm.auditeeId}
            onValueChange={(value) => setEngagementForm({ ...engagementForm, auditeeId: value })}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder={t("Select auditee")} />
            </SelectTrigger>
            <SelectContent>
              {auditees.length > 0 ? (
                auditees.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No auditees available")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Two columns for Start Date and Target Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">
            {t("Start Date")} <span className="text-red-500">*</span>
          </Label>
          <DatePicker
            value={engagementForm.startDate}
            onChange={(date) => setEngagementForm({ ...engagementForm, startDate: date ? date.toISOString().split('T')[0] : "" })}
            placeholder={t("Select start date")}
            className={`w-full h-10 bg-white ${validationErrors.startDate ? 'border-red-500' : ''}`}
          />
          {validationErrors.startDate && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.startDate}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">
            {t("Target Date")} <span className="text-red-500">*</span>
          </Label>
          <DatePicker
            value={engagementForm.targetDate}
            onChange={(date) => setEngagementForm({ ...engagementForm, targetDate: date ? date.toISOString().split('T')[0] : "" })}
            placeholder={t("Select target date")}
            className={`w-full h-10 bg-white ${validationErrors.targetDate ? 'border-red-500' : ''}`}
          />
          {validationErrors.targetDate && (
            <p className="text-sm text-red-600 mt-1">{validationErrors.targetDate}</p>
          )}
        </div>
      </div>

      {/* Attach File */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Attach File")}</Label>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragOverAttach ? "border-primary-500 bg-primary-50/50" : "border-slate-200 bg-slate-50/30 hover:bg-slate-50/60"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOverAttach(true); }}
          onDragLeave={() => setIsDragOverAttach(false)}
          onDrop={(e) => handleFileDrop(e, "attach")}
          onClick={() => attachFileRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 font-medium">{t("Drag and drop or select file.")}</p>
            <p className="text-xs text-slate-400">{t("Upload supporting documents")}</p>
          </div>
          <input
            ref={attachFileRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, "attach")}
          />
        </div>
        {attachedFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            {attachedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => removeFile(file.id, "attach")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Workpaper */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Upload Workpaper")}</Label>
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragOverWorkpaper ? "border-primary-500 bg-primary-50/50" : "border-slate-200 bg-slate-50/30 hover:bg-slate-50/60"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOverWorkpaper(true); }}
          onDragLeave={() => setIsDragOverWorkpaper(false)}
          onDrop={(e) => handleFileDrop(e, "workpaper")}
          onClick={() => workpaperRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 font-medium">{t("Drag and drop or select file.")}</p>
            <p className="text-xs text-slate-400">{t("Upload audit workpapers")}</p>
          </div>
          <input
            ref={workpaperRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, "workpaper")}
          />
        </div>
        {workpaperFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            {workpaperFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => removeFile(file.id, "workpaper")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Details - Tabs */}
      <div>
        <Tabs defaultValue="observation" className="w-full">
          <TabsList className="w-full justify-start bg-white border-b border-slate-200 rounded-none h-auto p-0">
            <TabsTrigger value="observation" className="data-[state=active]:bg-white data-[state=active]:border-b-0.5 data-[state=active]:border-primary-600">
              {t("Observation")}
            </TabsTrigger>
            <TabsTrigger value="procedure" className="data-[state=active]:bg-white data-[state=active]:border-b-0.5 data-[state=active]:border-primary-600">
              {t("Testing Procedure")}
            </TabsTrigger>
            <TabsTrigger value="policies" className="data-[state=active]:bg-white data-[state=active]:border-b-0.5 data-[state=active]:border-primary-600">
              {t("Policies & Procedures")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="observation" className="mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Auditor's Initial Observation")}</Label>
              <Textarea
                value={engagementForm.initialObservation}
                onChange={(e) => setEngagementForm({ ...engagementForm, initialObservation: e.target.value })}
                rows={5}
                className="w-full bg-white resize-none border-slate-200 focus:border-primary-300 focus:ring-primary-200"
                placeholder={t("Enter initial observations from the auditor")}
              />
            </div>
          </TabsContent>

          <TabsContent value="procedure" className="mt-6">
            <div className="space-y-4">
              {/* Header Section */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t("Testing Procedure Tasks")}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t("Define tasks and assign auditors for this engagement")}</p>
                </div>
                <Button
                  type="button"
                  onClick={addTaskRow}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Add Task")}
                </Button>
              </div>

              {/* Tasks List */}
              {tasks.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/30">
                  <p className="text-sm text-slate-500">{t("No tasks added yet")}</p>
                  <p className="text-xs text-slate-400 mt-1">{t("Click 'Add Task' to begin")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task, index) => (
                    <div
                      key={task.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="space-y-3">
                        {/* Task Header - Task Description */}
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center mt-1">
                            <span className="text-xs font-semibold text-slate-600">{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                              {t("Task Description")}
                            </Label>
                            <Input
                              value={task.task}
                              onChange={(e) => updateTask(task.id, "task", e.target.value)}
                              className="border-slate-200 text-sm bg-white focus:border-primary-300 focus:ring-primary-200"
                              placeholder={t("Enter task description")}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTask(task.id)}
                            className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Task Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 ltr:pl-10 rtl:pr-10">
                          {/* Status */}
                          <div className="md:col-span-3">
                            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                              {t("Status")}
                            </Label>
                            <div className="flex items-center gap-2 h-10 px-3 border border-slate-200 rounded-md bg-slate-50/50">
                              <Checkbox
                                checked={task.done}
                                onCheckedChange={(checked) => updateTask(task.id, "done", !!checked)}
                                id={`task-done-${task.id}`}
                              />
                              <label
                                htmlFor={`task-done-${task.id}`}
                                className="text-sm cursor-pointer select-none"
                              >
                                {task.done ? (
                                  <span className="text-green-600 font-medium">{t("Done")}</span>
                                ) : (
                                  <span className="text-slate-500">{t("Pending")}</span>
                                )}
                              </label>
                            </div>
                          </div>

                          {/* Planned Hours */}
                          <div className="md:col-span-2">
                            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                              {t("Planned (hrs)")}
                            </Label>
                            <Input
                              type="number"
                              value={task.plannedHours}
                              onChange={(e) => updateTask(task.id, "plannedHours", e.target.value)}
                              className="border-slate-200 text-sm bg-white focus:border-primary-300 focus:ring-primary-200 text-center"
                              placeholder="0"
                              min="0"
                              step="0.5"
                            />
                          </div>

                          {/* Actual Hours */}
                          <div className="md:col-span-2">
                            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                              {t("Actual (hrs)")}
                            </Label>
                            <Input
                              type="number"
                              value={task.actualHours}
                              onChange={(e) => updateTask(task.id, "actualHours", e.target.value)}
                              className="border-slate-200 text-sm bg-white focus:border-primary-300 focus:ring-primary-200 text-center"
                              placeholder="0"
                              min="0"
                              step="0.5"
                            />
                          </div>

                          {/* Auditor */}
                          <div className="md:col-span-5">
                            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                              {t("Assigned Auditor")}
                            </Label>
                            <Select
                              value={task.auditorId}
                              onValueChange={(value) => updateTask(task.id, "auditorId", value)}
                            >
                              <SelectTrigger className="border-slate-200 text-sm bg-white focus:border-primary-300 focus:ring-primary-200">
                                <SelectValue placeholder={t("Select auditor")} />
                              </SelectTrigger>
                              <SelectContent>
                                {auditors.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Comments */}
                          <div className="md:col-span-12">
                            <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                              {t("Comments")}
                            </Label>
                            <Input
                              value={task.comments}
                              onChange={(e) => updateTask(task.id, "comments", e.target.value)}
                              className="border-slate-200 text-sm bg-white focus:border-primary-300 focus:ring-primary-200"
                              placeholder={t("Add notes or comments for this task")}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Totals Summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">
                        {t("Total Hours")}
                      </span>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{t("Planned")}:</span>
                          <div className="bg-white border border-slate-200 rounded-md px-3 py-1.5 min-w-[60px] text-center">
                            <span className="text-sm font-bold text-slate-800">
                              {calculateTotalHours("plannedHours")}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{t("Actual")}:</span>
                          <div className="bg-white border border-slate-200 rounded-md px-3 py-1.5 min-w-[60px] text-center">
                            <span className="text-sm font-bold text-slate-800">
                              {calculateTotalHours("actualHours")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="policies" className="mt-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">{t("Related Policies / Procedures")}</Label>
              <Textarea
                value={engagementForm.relatedPolicies}
                onChange={(e) => setEngagementForm({ ...engagementForm, relatedPolicies: e.target.value })}
                rows={5}
                className="w-full bg-white resize-none border-slate-200 focus:border-primary-300 focus:ring-primary-200"
                placeholder={t("List relevant policies and procedures for this audit")}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );


  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">{t("Annual Audit Plan")}</h1>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm text-slate-500 font-medium">{t("Loading...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
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
        <span className="text-primary-700 font-medium">{t("Audit Planning")}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">{t("Annual Audit Plan")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t("Export")}
          </Button>
          <Button variant="outline" size="sm" className="border-primary-600 text-primary-600 hover:bg-primary-50" onClick={openReportDialog}>
            <FileText className="h-4 w-4 mr-2" />
            {t("Generate Annual Plan Report")}
          </Button>
          {isAuditHead && (
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("Add Engagement")}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search By Audit ID, Name")}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
            />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50 border-slate-200">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Status")}</SelectItem>
                <SelectItem value="Planned">{t("Planned")}</SelectItem>
                <SelectItem value="In Progress">{t("In Progress")}</SelectItem>
                <SelectItem value="Completed">{t("Completed")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[110px] h-9 text-sm bg-slate-50 border-slate-200">
                <SelectValue placeholder={t("Year")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("All Years")}</SelectItem>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="h-11 border-b border-slate-100 bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pl-5">{t("Audit ID")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Engagement Name")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Department")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Audit Type")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Assigned Auditors")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3">{t("Status")}</TableHead>
              <TableHead className="text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-5">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engagements.length > 0 ? (
              engagements.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0">
                  <TableCell className="py-3 pl-5 text-sm font-medium text-slate-800">{engagement.auditId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.engagementTitle}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.department?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.auditType || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">
                    {engagement.assignedAuditors.length > 0
                      ? engagement.assignedAuditors.join(", ")
                      : "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.status}</TableCell>
                  <TableCell className="py-3 pr-5">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={() => openEditDialog(engagement)}
                        title={t("Edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-semantic-error"
                        onClick={() => openDeleteDialog(engagement)}
                        title={t("Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                  {t("No audit engagements found")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("Are you sure you want to delete this engagement?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">{t("Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Selection Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 gap-0">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Generate Annual Plan Report")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                {t("Filter Type")} <span className="text-red-500">*</span>
              </Label>
              <Select value={reportFilterType} onValueChange={setReportFilterType}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder={t("Select filter type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year">{t("Year")}</SelectItem>
                  <SelectItem value="DateRange">{t("Date Range")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportFilterType === "Year" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  {t("Year")} <span className="text-red-500">*</span>
                </Label>
                <Select value={reportYear} onValueChange={setReportYear}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder={t("Select year")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {reportFilterType === "DateRange" && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("Start Date")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={reportStartDate}
                    onChange={(date) => setReportStartDate(date ? date.toISOString().split('T')[0] : "")}
                    placeholder={t("Select start date")}
                    className="w-full h-10 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">
                    {t("End Date")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={reportEndDate}
                    onChange={(date) => setReportEndDate(date ? date.toISOString().split('T')[0] : "")}
                    placeholder={t("Select end date")}
                    className="w-full h-10 bg-white"
                  />
                </div>
              </>
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleShowReport} className="bg-primary-600 hover:bg-primary-700">
              {t("Show Report")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Engagement Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Add Engagement")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {dialogLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : (
              renderEngagementFormContent()
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSaveEngagement}
              disabled={saving || dialogLoading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {saving ? t("Saving...") : t("Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Engagement Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Edit Audit Plan")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {dialogLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : (
              renderEngagementFormContent()
            )}
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingEngagementId(null); }}>
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleUpdateEngagement}
              disabled={saving || dialogLoading}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {saving ? t("Saving...") : t("Update")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Preview Modal */}
      <Dialog open={reportPreviewOpen} onOpenChange={setReportPreviewOpen}>
        <DialogContent className="sm:max-w-[900px] p-0 gap-0 max-h-[90vh] flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t("Annual Audit Plan Report")}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {/* Document Metadata */}
              <div className="space-y-3">
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Document Type")} :</span>
                  <span className="text-primary-600">{t("Annual plan report")}</span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Document Reference")} :</span>
                  <span className="text-primary-600">
                    {reportFilterType === "DateRange" && reportStartDate && reportEndDate
                      ? `MOF-IAD-${reportStartDate}-${reportEndDate}`
                      : `MOF-IAD-${reportYear}`}
                  </span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Responsible Department")} :</span>
                  <span className="text-slate-700">{t("Internal Audit Department")}</span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Document Description")} :</span>
                  <span className="text-slate-700">{t("This document includes the objectives and scope of the engagement, the audit team, completion timeline, execution phases, and reporting procedures.")}</span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Purpose")} :</span>
                  <span className="text-slate-700">{t("To use the form for documenting the planning of the internal audit engagement.")}</span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Scope of Application")} :</span>
                  <span className="text-slate-700">{t("Internal Audit Department")}</span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Related Policies")} :</span>
                  <div className="text-slate-700">
                    <p>• {t("Internal Audit Charter")}</p>
                    <p>• {t("Internal Audit Methodology")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Related Procedures")} :</span>
                  <span className="text-slate-700">{t("None")}</span>
                </div>
                <div className="grid grid-cols-[200px_1fr] gap-2">
                  <span className="font-semibold text-slate-700">{t("Reference Documents")} :</span>
                  <div className="text-slate-700">
                    <p>• {t("International Standards for the Professional Practice of Internal Auditing (IIA)")}</p>
                    <p>• {t("Supplementary Guidance issued by the Institute of Internal Auditors (IIA)")}</p>
                  </div>
                </div>
              </div>

              {/* Engagement Overview */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Engagement Overview")}</h3>
                <p className="text-slate-700">
                  {t("The independent review of the internal controls established by the department, assessing their adequacy and effectiveness against the objectives they aim to achieve, and ensuring compliance with laws, regulations, policies, and procedures related to the relevant control systems, etc")}
                </p>
                <ul className="list-disc list-inside text-slate-700 space-y-1">
                  <li>{t("Independent review of the internal control system and its adequacy and effectiveness.")}</li>
                  <li>{t("Verify compliance with laws, regulations, policies, and procedures.")}</li>
                  <li>{t("Review the procedures and policies implemented in the department.")}</li>
                  <li>{t("Follow up on the implementation of previous internal audit recommendations.")}</li>
                </ul>
              </div>

              {/* Audit Scope */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Audit Scope")}</h3>
                <p className="text-slate-700">{t("Financial year")} {reportFilterType === "DateRange" && reportStartDate ? reportStartDate.split("-")[0] : reportYear}</p>
              </div>

              {/* Initial Risks */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Initial Risks and Observations from Preliminary Document Review")}</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 w-40">{t("Count of Risk")}:</span>
                    <span className="text-primary-600 font-medium">
                      {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : reportStats.riskCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 w-40">{t("Count of Findings")}:</span>
                    <span className="text-primary-600 font-medium">
                      {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : reportStats.findingCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Procedures and Tests */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Audit Procedures and Tests")}</h3>
                <p className="text-slate-700">{t("The team shall adhere to the following")}:</p>
                <ol className="list-decimal list-inside text-slate-700 space-y-1">
                  <li>{t("Prepare and update the audit program and comply with it")}</li>
                  <li>{t("Use audit methods such as data analysis, document review, and sampling audit")}</li>
                  <li>{t("Follow up on previous audit results")}</li>
                </ol>
              </div>

              {/* Approvals */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900">{t("Approvals")}</h3>
                <div className="space-y-1">
                  <p className="text-slate-700">{t("Job Title")} : {t("Audit Head")}</p>
                  <p className="text-slate-700">
                    {t("Name")} : {loadingStats ? <Loader2 className="h-4 w-4 animate-spin inline" /> : (reportStats.auditHeadName || '-')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
            <Button variant="outline" onClick={() => setReportPreviewOpen(false)}>
              {t("Close")}
            </Button>
            <Button
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="bg-primary-600 hover:bg-primary-700"
            >
              {downloadingReport ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("Downloading...")}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {t("Download Report")}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
