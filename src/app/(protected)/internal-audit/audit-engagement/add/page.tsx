"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatLocalDate } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Home,
  Plus,
  Trash2,
  Upload,
  FileText,
  X,
  Loader2,
  Building2,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

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

interface Process {
  id: string;
  name: string;
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

// Per-department configuration
interface DepartmentConfig {
  auditorIds: string[];
  auditeeIds: string[];
  linkedRiskIds: string[];
}

// Per-department fetched data
interface DepartmentData {
  auditors: User[];
  auditees: User[];
  risks: Risk[];
  loading: boolean;
}

const defaultTaskKeys = [
  "Audit Preparation & Update",
  "Documentation Review",
  "Sample Selection",
  "Result of Previous Audit",
  "Related Policies",
  "Related Procedures",
];

export default function AddEngagementPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [auditRatings, setAuditRatings] = useState<ScoringRange[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  // Global auditors list for the task table
  const [globalAuditors, setGlobalAuditors] = useState<User[]>([]);

  // Form data — shared fields (same for all engagements)
  const [formData, setFormData] = useState({
    engagementTitle: "",
    engagementObjective: "",
    engagementScope: "",
    auditRating: "",
    auditType: "",
    processId: "",
    startDate: "",
    targetDate: "",
    initialObservation: "",
    relatedPolicies: "",
  });

  // Multi-department state
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [departmentConfigs, setDepartmentConfigs] = useState<Record<string, DepartmentConfig>>({});
  const [departmentData, setDepartmentData] = useState<Record<string, DepartmentData>>({});

  // Tasks — initialize with English keys, then translate via effect
  const [tasks, setTasks] = useState<AuditTask[]>(() =>
    defaultTaskKeys.map((key, i) => ({
      id: String(i + 1),
      task: key,
      done: false,
      plannedHours: "",
      actualHours: "",
      auditorId: "",
      comments: "",
    }))
  );

  // Translate default task names when translations become available (e.g. Arabic)
  useEffect(() => {
    setTasks(prev => prev.map((task) => {
      const keyIndex = defaultTaskKeys.indexOf(task.task);
      if (keyIndex !== -1) {
        return { ...task, task: t(defaultTaskKeys[keyIndex]) };
      }
      return task;
    }));
  }, [t]);

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

  useEffect(() => {
    fetchReferenceData();
  }, []);

  // Fetch per-department data when departments are selected/deselected
  const fetchDepartmentUsers = useCallback(async (deptId: string) => {
    setDepartmentData(prev => ({
      ...prev,
      [deptId]: { ...prev[deptId], auditors: prev[deptId]?.auditors || [], auditees: prev[deptId]?.auditees || [], risks: prev[deptId]?.risks || [], loading: true }
    }));

    try {
      const [auditorsRes, auditeesRes, risksRes] = await Promise.all([
        fetch(`/api/internal-audit/users?role=auditors&departmentId=${deptId}`),
        fetch(`/api/internal-audit/users?role=Auditee&departmentId=${deptId}`),
        fetch(`/api/internal-audit/risks?departmentId=${deptId}&status=Open`),
      ]);

      const auditors = auditorsRes.ok ? (await auditorsRes.json()) : [];
      const auditees = auditeesRes.ok ? (await auditeesRes.json()) : [];
      const risks = risksRes.ok ? (await risksRes.json()) : [];

      setDepartmentData(prev => ({
        ...prev,
        [deptId]: {
          auditors: Array.isArray(auditors) ? auditors : (auditors.users || []),
          auditees: Array.isArray(auditees) ? auditees : (auditees.users || []),
          risks: Array.isArray(risks) ? risks : [],
          loading: false,
        }
      }));
    } catch (error) {
      console.error(`Failed to fetch data for department ${deptId}:`, error);
      setDepartmentData(prev => ({
        ...prev,
        [deptId]: { auditors: [], auditees: [], risks: [], loading: false }
      }));
    }
  }, []);

  const handleDepartmentSelectionChange = useCallback((newSelectedIds: string[]) => {
    setSelectedDepartmentIds(newSelectedIds);

    // Initialize configs for newly added departments
    setDepartmentConfigs(prev => {
      const updated = { ...prev };
      for (const deptId of newSelectedIds) {
        if (!updated[deptId]) {
          updated[deptId] = { auditorIds: [], auditeeIds: [], linkedRiskIds: [] };
        }
      }
      return updated;
    });

    // Fetch data for newly added departments
    for (const deptId of newSelectedIds) {
      if (!departmentData[deptId]) {
        fetchDepartmentUsers(deptId);
      }
    }
  }, [departmentData, fetchDepartmentUsers]);

  const removeDepartment = useCallback((deptId: string) => {
    setSelectedDepartmentIds(prev => prev.filter(id => id !== deptId));
    setDepartmentConfigs(prev => {
      const updated = { ...prev };
      delete updated[deptId];
      return updated;
    });
  }, []);

  const updateDepartmentConfig = useCallback((deptId: string, field: keyof DepartmentConfig, value: string[]) => {
    setDepartmentConfigs(prev => ({
      ...prev,
      [deptId]: { ...prev[deptId], [field]: value }
    }));
  }, []);

  const fetchReferenceData = async () => {
    try {
      const [deptRes, auditorsRes, auditTypesRes, scoringRangesRes, processesRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/internal-audit/users?role=auditors"),
        fetch("/api/internal-audit/audit-types"),
        fetch("/api/internal-audit/scoring-ranges"),
        fetch("/api/processes"),
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (auditorsRes.ok) {
        const data = await auditorsRes.json();
        setGlobalAuditors(data.users || data || []);
      }
      if (auditTypesRes.ok) {
        const auditTypesData = await auditTypesRes.json();
        setAuditTypes(auditTypesData || []);
      }
      if (scoringRangesRes.ok) {
        const scoringRangesData = await scoringRangesRes.json();
        const uniqueLabels = [...new Set<string>(scoringRangesData.map((r: ScoringRange) => r.label))];
        setAuditRatings(uniqueLabels.map((label) => ({ id: label, label })));
      }
      if (processesRes.ok) {
        const processesData = await processesRes.json();
        setProcesses(processesData || []);
      }
    } catch (error) {
      console.error("Failed to fetch reference data:", error);
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.engagementTitle.trim()) {
      toast.error(t("Engagement Title is required"));
      return;
    }
    if (!formData.engagementObjective.trim()) {
      toast.error(t("Engagement Objective is required"));
      return;
    }
    if (!formData.engagementScope.trim()) {
      toast.error(t("Engagement Scope is required"));
      return;
    }
    if (selectedDepartmentIds.length === 0) {
      toast.error(t("At least one department must be selected"));
      return;
    }
    if (!formData.startDate) {
      toast.error(t("Start Date is required"));
      return;
    }
    if (!formData.targetDate) {
      toast.error(t("Target Date is required"));
      return;
    }

    // Validate each department has at least one auditor
    for (const deptId of selectedDepartmentIds) {
      const config = departmentConfigs[deptId];
      if (!config?.auditorIds?.length) {
        const dept = departments.find(d => d.id === deptId);
        toast.error(t("Auditor is required") + ` (${dept?.name || deptId})`);
        return;
      }
    }

    setSaving(true);
    try {
      // Build batch request
      const departmentsPayload = selectedDepartmentIds.map(deptId => ({
        departmentId: deptId,
        auditorIds: departmentConfigs[deptId]?.auditorIds || [],
        auditeeIds: departmentConfigs[deptId]?.auditeeIds || [],
        linkedRiskIds: departmentConfigs[deptId]?.linkedRiskIds || [],
      }));

      const response = await fetch("/api/internal-audit/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          departments: departmentsPayload,
          tasks,
          plannedHours: calculateTotalHours("plannedHours"),
        }),
      });

      if (response.ok) {
        const savedEngagements = await response.json();
        // Trigger translations for each created engagement
        const engagementList = Array.isArray(savedEngagements) ? savedEngagements : [savedEngagements];
        for (const eng of engagementList) {
          if (eng?.id) {
            triggerTranslation('AuditEngagement', eng.id, {
              engagementTitle: formData.engagementTitle,
              engagementObjective: formData.engagementObjective,
              engagementScope: formData.engagementScope,
              initialObservation: formData.initialObservation || null,
              relatedPolicies: formData.relatedPolicies || null,
            });
          }
        }
        const count = engagementList.length;
        toast.success(count > 1
          ? `${count} ${t("engagements created successfully")}`
          : t("Engagement created successfully")
        );
        router.push("/internal-audit/audit-engagement");
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

  // Dynamic data translation hooks — BEFORE early returns
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedAuditTypes } = useTranslatedData(auditTypes, { modelName: 'AuditType' });
  const { data: translatedAuditRatings } = useTranslatedData(auditRatings, { modelName: 'AuditScoringRange' });
  const { data: translatedProcesses } = useTranslatedData(processes, { modelName: 'Process' });

  // Helper to get department name
  const getDeptName = useCallback((deptId: string) => {
    return translatedDepartments.find(d => d.id === deptId)?.name || departments.find(d => d.id === deptId)?.name || deptId;
  }, [translatedDepartments, departments]);

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
        <nav className="flex items-center gap-1.5 text-sm mb-6 overflow-x-auto whitespace-nowrap">
          <Link href="/internal-audit/audit-engagement" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/internal-audit/audit-engagement" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Audit Engagement")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Add Audit Plan")}</span>
        </nav>
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("Back")}
          </Button>
          <div className="text-sm text-muted-foreground">{t("Audit Plan")}</div>
          <h1 className="text-xl font-semibold text-blue-900">{t("New Audit Plan")}</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/internal-audit/audit-engagement" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/audit-engagement" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Audit Engagement")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Add Audit Plan")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("Back")}
        </Button>
        <div className="text-sm text-muted-foreground">{t("Audit Plan")}</div>
        <h1 className="text-xl sm:text-2xl font-semibold text-blue-900">{t("New Audit Plan")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Engagement Title */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            {t("Engagement Title")} <span className="text-red-500">*</span>
          </Label>
          <Input
            value={formData.engagementTitle}
            onChange={(e) => setFormData({ ...formData, engagementTitle: e.target.value })}
            placeholder={t("Enter Name")}
          />
        </div>

        {/* Engagement Objective */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            {t("Engagement Objective")} <span className="text-red-500">*</span>
          </Label>
          <Textarea
            value={formData.engagementObjective}
            onChange={(e) => setFormData({ ...formData, engagementObjective: e.target.value })}
            placeholder={t("Objective")}
            rows={4}
          />
        </div>

        {/* Engagement Scope */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            {t("Engagement Scope")} <span className="text-red-500">*</span>
          </Label>
          <Textarea
            value={formData.engagementScope}
            onChange={(e) => setFormData({ ...formData, engagementScope: e.target.value })}
            placeholder={t("Scope")}
            rows={4}
          />
        </div>

        {/* Departments — Multi-select */}
        <div className="space-y-2">
          <Label className="text-blue-800">
            {t("Select Departments")} <span className="text-red-500">*</span>
          </Label>
          <MultiSelect
            options={translatedDepartments.map(d => ({ value: d.id, label: d.name }))}
            selected={selectedDepartmentIds}
            onChange={handleDepartmentSelectionChange}
            placeholder={t("Select Departments")}
          />
          {selectedDepartmentIds.length > 0 && (
            <p className="text-sm text-gray-500">
              {selectedDepartmentIds.length} {t("departments selected")}
            </p>
          )}
        </div>

        {/* Per-Department Configuration Cards */}
        {selectedDepartmentIds.length > 0 && (
          <div className="space-y-4">
            {selectedDepartmentIds.map((deptId) => {
              const deptName = getDeptName(deptId);
              const config = departmentConfigs[deptId] || { auditorIds: [], auditeeIds: [], linkedRiskIds: [] };
              const data = departmentData[deptId] || { auditors: [], auditees: [], risks: [], loading: true };

              return (
                <div key={deptId} className="border border-gray-200 rounded-lg bg-white p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-gray-500" />
                      <h3 className="font-medium text-gray-800">{deptName}</h3>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDepartment(deptId)}
                      className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {data.loading ? (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      <span className="text-sm text-gray-500">{t("Loading...")}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Auditor multi-select */}
                      <div className="space-y-2">
                        <Label className="text-gray-700 text-sm">
                          {t("Auditor")} <span className="text-red-500">*</span>
                        </Label>
                        <MultiSelect
                          options={data.auditors.map(u => ({ value: u.id, label: u.fullName }))}
                          selected={config.auditorIds}
                          onChange={(val) => updateDepartmentConfig(deptId, 'auditorIds', val)}
                          placeholder={t("Select Auditor")}
                        />
                        {data.auditors.length === 0 && (
                          <p className="text-xs text-amber-600">{t("No auditors found in this department")}</p>
                        )}
                      </div>

                      {/* Auditee multi-select */}
                      <div className="space-y-2">
                        <Label className="text-gray-700 text-sm">{t("Auditee")}</Label>
                        <MultiSelect
                          options={data.auditees.map(u => ({ value: u.id, label: u.fullName }))}
                          selected={config.auditeeIds}
                          onChange={(val) => updateDepartmentConfig(deptId, 'auditeeIds', val)}
                          placeholder={t("Select Auditee")}
                        />
                        {data.auditees.length === 0 && (
                          <p className="text-xs text-amber-600">{t("No auditees found in this department")}</p>
                        )}
                      </div>

                      {/* Linked Risks multi-select */}
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-gray-700 text-sm">{t("Link Open Risks in this Department")}</Label>
                        <MultiSelect
                          options={data.risks.map(r => ({ value: r.id, label: `${r.riskId} - ${r.riskName}` }))}
                          selected={config.linkedRiskIds}
                          onChange={(val) => updateDepartmentConfig(deptId, 'linkedRiskIds', val)}
                          placeholder={t("Select Risk")}
                        />
                        {data.risks.length === 0 && (
                          <p className="text-xs text-gray-500">{t("No open risks found")}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Audit Rating */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Audit Rating")}</Label>
          <Select
            value={formData.auditRating}
            onValueChange={(value) => setFormData({ ...formData, auditRating: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Audit Rating")} />
            </SelectTrigger>
            <SelectContent>
              {translatedAuditRatings.length > 0 ? (
                translatedAuditRatings.map((rating) => (
                  <SelectItem key={rating.id} value={rating.label}>
                    {rating.label}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No ratings configured. Add in Settings > Risk Assessment.")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Audit Type */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Audit Type")}</Label>
          <Select
            value={formData.auditType}
            onValueChange={(value) => setFormData({ ...formData, auditType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Audit Type")} />
            </SelectTrigger>
            <SelectContent>
              {translatedAuditTypes.length > 0 ? (
                translatedAuditTypes.map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No audit types configured. Add in Settings > Audit Type.")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Process */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Process")}</Label>
          <Select
            value={formData.processId}
            onValueChange={(value) => setFormData({ ...formData, processId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Process")} />
            </SelectTrigger>
            <SelectContent>
              {translatedProcesses.length > 0 ? (
                translatedProcesses.map((process) => (
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

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <Label className="text-blue-800">
              {t("Start Date")} <span className="text-red-500">*</span>
            </Label>
            <DatePicker
              value={formData.startDate}
              onChange={(date) => setFormData({ ...formData, startDate: date ? formatLocalDate(date) : "" })}
              placeholder={t("Select start date")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-blue-800">
              {t("Target Date")} <span className="text-red-500">*</span>
            </Label>
            <DatePicker
              value={formData.targetDate}
              onChange={(date) => setFormData({ ...formData, targetDate: date ? formatLocalDate(date) : "" })}
              placeholder={t("Select target date")}
            />
          </div>
        </div>

        {/* Attach File */}
        <div className="space-y-2">
          <Label className="text-blue-800">{t("Attach File")}</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragOverAttach ? "border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverAttach(true); }}
            onDragLeave={() => setIsDragOverAttach(false)}
            onDrop={(e) => handleFileDrop(e, "attach")}
            onClick={() => attachFileRef.current?.click()}
          >
            <p className="text-gray-600">{t("Drag and drop or select file.")}</p>
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
                <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-gray-400">({formatFileSize(file.size)})</span>
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
          <Label className="text-blue-800">{t("Upload Workpaper")}</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragOverWorkpaper ? "border-blue-500 bg-blue-50" : "border-gray-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverWorkpaper(true); }}
            onDragLeave={() => setIsDragOverWorkpaper(false)}
            onDrop={(e) => handleFileDrop(e, "workpaper")}
            onClick={() => workpaperRef.current?.click()}
          >
            <p className="text-gray-600">{t("Drag and drop or select file.")}</p>
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
                <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-gray-400">({formatFileSize(file.size)})</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(file.id, "workpaper")}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Initial Audit Observation */}
        <Collapsible open={observationOpen} onOpenChange={setObservationOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 rounded-lg hover:bg-blue-100">
            <span className="text-blue-800 font-medium">{t("Initial Audit Observation")}</span>
            {observationOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="space-y-2">
              <Label className="text-blue-800">{t("Auditor's Initial Observation")}</Label>
              <Textarea
                value={formData.initialObservation}
                onChange={(e) => setFormData({ ...formData, initialObservation: e.target.value })}
                rows={4}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Audit Testing Procedure */}
        <Collapsible open={procedureOpen} onOpenChange={setProcedureOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 rounded-lg hover:bg-blue-100">
            <span className="text-blue-800 font-medium">{t("Audit Testing Procedure")}</span>
            {procedureOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="flex ltr:justify-end rtl:justify-start mb-4">
              <Button type="button" onClick={addTaskRow} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                {t("Add Task Row")}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="text-left text-blue-800">
                    <th className="p-2 border-b">{t("Task")}</th>
                    <th className="p-2 border-b w-16">{t("Done")}</th>
                    <th className="p-2 border-b w-24">{t("Planned Hours")}</th>
                    <th className="p-2 border-b w-24">{t("Actual Hours")}</th>
                    <th className="p-2 border-b w-40">{t("Auditor")}</th>
                    <th className="p-2 border-b">{t("Comments")}</th>
                    <th className="p-2 border-b w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td className="p-2 border-b">
                        <Input
                          value={task.task}
                          onChange={(e) => updateTask(task.id, "task", e.target.value)}
                          className="border-gray-200"
                        />
                      </td>
                      <td className="p-2 border-b text-center">
                        <Checkbox
                          checked={task.done}
                          onCheckedChange={(checked) => updateTask(task.id, "done", !!checked)}
                        />
                      </td>
                      <td className="p-2 border-b">
                        <Input
                          type="number"
                          value={task.plannedHours}
                          onChange={(e) => updateTask(task.id, "plannedHours", e.target.value)}
                          className="border-gray-200"
                        />
                      </td>
                      <td className="p-2 border-b">
                        <Input
                          type="number"
                          value={task.actualHours}
                          onChange={(e) => updateTask(task.id, "actualHours", e.target.value)}
                          className="border-gray-200"
                        />
                      </td>
                      <td className="p-2 border-b">
                        <Select
                          value={task.auditorId}
                          onValueChange={(value) => updateTask(task.id, "auditorId", value)}
                        >
                          <SelectTrigger className="border-gray-200">
                            <SelectValue placeholder={t("Select Auditor")} />
                          </SelectTrigger>
                          <SelectContent>
                            {globalAuditors.length > 0 ? (
                              globalAuditors.map((user) => (
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
                      </td>
                      <td className="p-2 border-b">
                        <Input
                          value={task.comments}
                          onChange={(e) => updateTask(task.id, "comments", e.target.value)}
                          className="border-gray-200"
                        />
                      </td>
                      <td className="p-2 border-b">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTask(task.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2 text-blue-800">{t("Total")}: {calculateTotalHours("plannedHours")}</td>
                    <td className="p-2 text-blue-800">{t("Total")}: {calculateTotalHours("actualHours")}</td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                    <td className="p-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Related Policies & Procedures */}
        <Collapsible open={policiesOpen} onOpenChange={setPoliciesOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-blue-50 rounded-lg hover:bg-blue-100">
            <span className="text-blue-800 font-medium">{t("Related Policies & Procedures")}</span>
            {policiesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="space-y-2">
              <Label className="text-blue-800">{t("Related Policies / Procedures")}</Label>
              <Textarea
                value={formData.relatedPolicies}
                onChange={(e) => setFormData({ ...formData, relatedPolicies: e.target.value })}
                rows={4}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Action Buttons */}
        <div className="flex flex-row ltr:justify-end rtl:justify-start gap-3 sm:gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/internal-audit/audit-engagement")}
          >
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? t("Saving...") : t("Save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
