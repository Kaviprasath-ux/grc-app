"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { DatePicker } from "@/components/ui/date-picker";
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
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
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

  // File uploads
  const attachFileRef = useRef<HTMLInputElement>(null);
  const workpaperRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [workpaperFiles, setWorkpaperFiles] = useState<UploadedFile[]>([]);
  const [isDragOverAttach, setIsDragOverAttach] = useState(false);
  const [isDragOverWorkpaper, setIsDragOverWorkpaper] = useState(false);

  // Collapsible sections
  const [observationOpen, setObservationOpen] = useState(false);
  const [procedureOpen, setProcedureOpen] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);

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
    setObservationOpen(false);
    setProcedureOpen(false);
    setPoliciesOpen(false);
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
    if (!engagementForm.engagementTitle.trim()) {
      toast.error(t("Engagement Title is required"));
      return false;
    }
    if (!engagementForm.engagementObjective.trim()) {
      toast.error(t("Engagement Objective is required"));
      return false;
    }
    if (!engagementForm.engagementScope.trim()) {
      toast.error(t("Engagement Scope is required"));
      return false;
    }
    if (!engagementForm.departmentId) {
      toast.error(t("Department is required"));
      return false;
    }
    if (!engagementForm.auditorId) {
      toast.error(t("Auditor is required"));
      return false;
    }
    if (!engagementForm.startDate) {
      toast.error(t("Start Date is required"));
      return false;
    }
    if (!engagementForm.targetDate) {
      toast.error(t("Target Date is required"));
      return false;
    }
    return true;
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

  const handleShowReport = () => {
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

    if (reportFilterType === "Year") {
      router.push(`/internal-audit/audit-planning/report-preview?filterType=Year&year=${reportYear}`);
    } else {
      router.push(`/internal-audit/audit-planning/report-preview?filterType=DateRange&startDate=${reportStartDate}&endDate=${reportEndDate}`);
    }
  };

  // Render the engagement form content (shared between Add and Edit dialogs)
  const renderEngagementFormContent = () => (
    <div className="space-y-4">
      {/* Engagement Title */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">
          {t("Engagement Title")} <span className="text-red-500">*</span>
        </Label>
        <Input
          value={engagementForm.engagementTitle}
          onChange={(e) => setEngagementForm({ ...engagementForm, engagementTitle: e.target.value })}
          placeholder={t("Enter engagement title")}
          className="w-full bg-white"
        />
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
          className="w-full bg-white resize-none"
        />
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
          className="w-full bg-white resize-none"
        />
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
          <SelectTrigger className="w-full bg-white">
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
        <div className="border rounded-lg p-3 min-h-[50px] bg-slate-50">
          {historicalRisks.length > 0 ? (
            <ul className="space-y-1">
              {historicalRisks.map((risk) => (
                <li key={risk.id} className="text-sm text-slate-600">
                  {risk.riskId} - {risk.riskName} ({risk.riskLevel || t("N/A")})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-center text-sm">{t("No items found")}</p>
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
            <SelectTrigger className="w-full bg-white">
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
            className="w-full h-10 bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">
            {t("Target Date")} <span className="text-red-500">*</span>
          </Label>
          <DatePicker
            value={engagementForm.targetDate}
            onChange={(date) => setEngagementForm({ ...engagementForm, targetDate: date ? date.toISOString().split('T')[0] : "" })}
            placeholder={t("Select target date")}
            className="w-full h-10 bg-white"
          />
        </div>
      </div>

      {/* Attach File */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">{t("Attach File")}</Label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOverAttach ? "border-primary-500 bg-primary-50" : "border-slate-300"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOverAttach(true); }}
          onDragLeave={() => setIsDragOverAttach(false)}
          onDrop={(e) => handleFileDrop(e, "attach")}
          onClick={() => attachFileRef.current?.click()}
        >
          <p className="text-slate-500 text-sm">{t("Drag and drop or select file.")}</p>
          <input
            ref={attachFileRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, "attach")}
          />
        </div>
        {attachedFiles.length > 0 && (
          <div className="space-y-2 mt-2">
            {attachedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-slate-400">({formatFileSize(file.size)})</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(file.id, "attach")}>
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
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOverWorkpaper ? "border-primary-500 bg-primary-50" : "border-slate-300"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOverWorkpaper(true); }}
          onDragLeave={() => setIsDragOverWorkpaper(false)}
          onDrop={(e) => handleFileDrop(e, "workpaper")}
          onClick={() => workpaperRef.current?.click()}
        >
          <p className="text-slate-500 text-sm">{t("Drag and drop or select file.")}</p>
          <input
            ref={workpaperRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, "workpaper")}
          />
        </div>
        {workpaperFiles.length > 0 && (
          <div className="space-y-2 mt-2">
            {workpaperFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm">{file.name}</span>
                  <span className="text-xs text-slate-400">({formatFileSize(file.size)})</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(file.id, "workpaper")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Initial Audit Observation - Collapsible */}
      <Collapsible open={observationOpen} onOpenChange={setObservationOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
          <span className="text-slate-700 font-medium text-sm">{t("Initial Audit Observation")}</span>
          {observationOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 border border-t-0 rounded-b-lg bg-white">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">{t("Auditor's Initial Observation")}</Label>
            <Textarea
              value={engagementForm.initialObservation}
              onChange={(e) => setEngagementForm({ ...engagementForm, initialObservation: e.target.value })}
              rows={3}
              className="w-full bg-white resize-none"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Audit Testing Procedure - Collapsible */}
      <Collapsible open={procedureOpen} onOpenChange={setProcedureOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
          <span className="text-slate-700 font-medium text-sm">{t("Audit Testing Procedure")}</span>
          {procedureOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 border border-t-0 rounded-b-lg bg-white">
          <div className="flex justify-end mb-3">
            <Button type="button" size="sm" onClick={addTaskRow} className="bg-primary-600 hover:bg-primary-700">
              <Plus className="h-3 w-3 mr-1" />
              {t("Add Task Row")}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="p-2 border-b font-medium">{t("Task")}</th>
                  <th className="p-2 border-b w-12 font-medium">{t("Done")}</th>
                  <th className="p-2 border-b w-20 font-medium">{t("Planned Hours")}</th>
                  <th className="p-2 border-b w-20 font-medium">{t("Actual Hours")}</th>
                  <th className="p-2 border-b w-32 font-medium">{t("Auditor")}</th>
                  <th className="p-2 border-b font-medium">{t("Comments")}</th>
                  <th className="p-2 border-b w-10"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="p-1 border-b">
                      <Input
                        value={task.task}
                        onChange={(e) => updateTask(task.id, "task", e.target.value)}
                        className="border-slate-200 h-8 text-sm"
                      />
                    </td>
                    <td className="p-1 border-b text-center">
                      <Checkbox
                        checked={task.done}
                        onCheckedChange={(checked) => updateTask(task.id, "done", !!checked)}
                      />
                    </td>
                    <td className="p-1 border-b">
                      <Input
                        type="number"
                        value={task.plannedHours}
                        onChange={(e) => updateTask(task.id, "plannedHours", e.target.value)}
                        className="border-slate-200 h-8 text-sm"
                      />
                    </td>
                    <td className="p-1 border-b">
                      <Input
                        type="number"
                        value={task.actualHours}
                        onChange={(e) => updateTask(task.id, "actualHours", e.target.value)}
                        className="border-slate-200 h-8 text-sm"
                      />
                    </td>
                    <td className="p-1 border-b">
                      <Select
                        value={task.auditorId}
                        onValueChange={(value) => updateTask(task.id, "auditorId", value)}
                      >
                        <SelectTrigger className="border-slate-200 h-8 text-sm">
                          <SelectValue placeholder={t("Select")} />
                        </SelectTrigger>
                        <SelectContent>
                          {auditors.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1 border-b">
                      <Input
                        value={task.comments}
                        onChange={(e) => updateTask(task.id, "comments", e.target.value)}
                        className="border-slate-200 h-8 text-sm"
                      />
                    </td>
                    <td className="p-1 border-b">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTask(task.id)}
                        className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="font-medium text-sm">
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  <td className="p-2 text-slate-700">{t("Total")}: {calculateTotalHours("plannedHours")}</td>
                  <td className="p-2 text-slate-700">{t("Total")}: {calculateTotalHours("actualHours")}</td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Related Policies & Procedures - Collapsible */}
      <Collapsible open={policiesOpen} onOpenChange={setPoliciesOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
          <span className="text-slate-700 font-medium text-sm">{t("Related Policies & Procedures")}</span>
          {policiesOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 border border-t-0 rounded-b-lg bg-white">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700">{t("Related Policies / Procedures")}</Label>
            <Textarea
              value={engagementForm.relatedPolicies}
              onChange={(e) => setEngagementForm({ ...engagementForm, relatedPolicies: e.target.value })}
              rows={3}
              className="w-full bg-white resize-none"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
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
        <Link href="/internal-audit/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-primary-700 font-medium">{t("Audit Planning")}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t("Annual Audit Plan")}</h1>
      </div>

      {/* Search, Filters, and Actions Row */}
      <div className="flex items-center gap-3">
        <div className="relative w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("Search By Audit ID, Name")}
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10 h-9 bg-white border-slate-200"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-white">
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
          <SelectTrigger className="w-[140px] h-9 bg-white">
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
          <SelectTrigger className="w-[110px] h-9 bg-white">
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
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          {t("Export")}
        </Button>
        <Button variant="outline" size="sm" className="border-primary-600 text-primary-600 hover:bg-primary-50" onClick={openReportDialog}>
          <FileText className="h-4 w-4 mr-2" />
          {t("Generate Annual Plan Report")}
        </Button>
        {isAuditHead && (
          <Button size="sm" className="bg-primary-600 hover:bg-primary-700" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t("Add Engagement")}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-100 bg-slate-50/50">
              <TableHead className="text-xs font-semibold text-slate-600 py-4 pl-4">{t("Audit ID")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Engagement Name")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Department")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Audit Type")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Assigned Auditors")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4">{t("Status")}</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 py-4 pr-4">{t("Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engagements.length > 0 ? (
              engagements.map((engagement) => (
                <TableRow key={engagement.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <TableCell className="py-3 pl-4 text-sm font-medium text-slate-800">{engagement.auditId}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.engagementTitle}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.department?.name || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.auditType || "-"}</TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">
                    {engagement.assignedAuditors.length > 0
                      ? engagement.assignedAuditors.join(", ")
                      : "-"}
                  </TableCell>
                  <TableCell className="py-3 text-sm text-slate-700">{engagement.status}</TableCell>
                  <TableCell className="py-3 pr-4">
                    <div className="flex items-center gap-1">
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
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
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
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleDelete}>{t("OK")}</AlertDialogAction>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
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
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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
          <div className="flex-shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
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

    </div>
  );
}
