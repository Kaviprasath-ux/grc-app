"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatLocalDate } from "@/lib/utils";
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Home,
  Plus,
  Trash2,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

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

interface Process {
  id: string;
  name: string;
}

interface ScoringRange {
  id: string;
  label: string;
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

interface PageProps {
  params: Promise<{ id: string }>;
}

const defaultTaskKeys = [
  "Audit Preparation & Update",
  "Documentation Review",
  "Sample Selection",
  "Result of Previous Audit",
  "Related Policies",
  "Related Procedures",
];

export default function EditEngagementPage({ params }: PageProps) {
  const { id: engagementId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reference data
  const [departments, setDepartments] = useState<Department[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditees, setAuditees] = useState<User[]>([]);
  const [auditors, setAuditors] = useState<User[]>([]);
  const [auditTypes, setAuditTypes] = useState<AuditType[]>([]);
  const [auditRatings, setAuditRatings] = useState<ScoringRange[]>([]);
  const [historicalRisks, setHistoricalRisks] = useState<Risk[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    engagementTitle: "",
    engagementObjective: "",
    engagementScope: "",
    departmentId: "",
    linkedRiskIds: [] as string[],
    processId: "",
    auditRating: "",
    auditType: "",
    auditorId: "",
    auditeeId: "",
    startDate: "",
    targetDate: "",
    initialObservation: "",
    relatedPolicies: "",
  });

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

  useEffect(() => {
    if (formData.departmentId) {
      fetchRisksForDepartment(formData.departmentId);
      fetchHistoricalRisks(formData.departmentId);
    } else {
      setRisks([]);
      setHistoricalRisks([]);
    }
  }, [formData.departmentId]);

  const fetchReferenceData = async () => {
    try {
      const [deptRes, usersRes, auditeesRes, auditorsRes, auditTypesRes, scoringRangesRes, processesRes, engagementRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/internal-audit/users?role=Auditee"), // Auditees associated with this Audit Head
        fetch("/api/internal-audit/users?role=auditors"), // Audit Head + Audit Managers
        fetch("/api/internal-audit/audit-types"), // Audit Types from settings
        fetch("/api/internal-audit/scoring-ranges"), // Scoring Ranges for audit ratings
        fetch("/api/internal-audit/processes"), // Internal Audit Processes
        fetch(`/api/internal-audit/engagements/${engagementId}`),
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || usersData || []);
      }
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

      if (engagementRes.ok) {
        const engagement = await engagementRes.json();
        console.log("Loaded engagement:", engagement);

        setFormData({
          engagementTitle: engagement.engagementTitle || "",
          engagementObjective: engagement.engagementObjective || "",
          engagementScope: engagement.engagementScope || "",
          departmentId: engagement.departmentId || "",
          linkedRiskIds: engagement.linkedRiskIds || [],
          processId: engagement.processId || "",
          auditRating: engagement.auditRating || "",
          auditType: engagement.auditType || "",
          auditorId: engagement.assignedAuditorId || "",
          auditeeId: engagement.auditeeId || "",
          startDate: engagement.plannedStartDate ? engagement.plannedStartDate.split("T")[0] : "",
          targetDate: engagement.plannedEndDate ? engagement.plannedEndDate.split("T")[0] : "",
          initialObservation: engagement.initialObservation || "",
          relatedPolicies: engagement.relatedPolicies || "",
        });

      } else {
        const errorData = await engagementRes.json();
        console.error("Failed to load engagement:", errorData);
        toast({ title: t("Error"), description: errorData.error || t("Failed to load engagement"), variant: "destructive" });
        router.push("/internal-audit/audit-planning");
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ title: t("Error"), description: t("Failed to load data"), variant: "destructive" });
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
      toast({ title: t("Error"), description: t("Engagement Title is required"), variant: "destructive" });
      return;
    }
    if (!formData.engagementObjective.trim()) {
      toast({ title: t("Error"), description: t("Engagement Objective is required"), variant: "destructive" });
      return;
    }
    if (!formData.engagementScope.trim()) {
      toast({ title: t("Error"), description: t("Engagement Scope is required"), variant: "destructive" });
      return;
    }
    if (!formData.departmentId) {
      toast({ title: t("Error"), description: t("Department is required"), variant: "destructive" });
      return;
    }
    if (!formData.startDate) {
      toast({ title: t("Error"), description: t("Start Date is required"), variant: "destructive" });
      return;
    }
    if (!formData.targetDate) {
      toast({ title: t("Error"), description: t("Target Date is required"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        tasks,
        plannedHours: calculateTotalHours("plannedHours"),
      };

      const response = await fetch(`/api/internal-audit/engagements/${engagementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        triggerTranslation('AuditEngagement', engagementId, {
          engagementTitle: formData.engagementTitle,
          engagementObjective: formData.engagementObjective,
          engagementScope: formData.engagementScope,
          initialObservation: formData.initialObservation || null,
          relatedPolicies: formData.relatedPolicies || null,
        });
        toast({ title: t("Success"), description: t("Engagement updated successfully") });
        router.push("/internal-audit/audit-planning");
      } else {
        const error = await response.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update engagement"), variant: "destructive" });
      }
    } catch (error) {
      toast({ title: t("Error"), description: t("Failed to update engagement"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Dynamic data translation hooks — BEFORE early returns
  const { data: translatedDepartments } = useTranslatedData(departments, { modelName: 'Department' });
  const { data: translatedRisks } = useTranslatedData(risks, { modelName: 'InternalAuditRisk' });
  const { data: translatedHistoricalRisks } = useTranslatedData(historicalRisks, { modelName: 'InternalAuditRisk' });
  const { data: translatedAuditTypes } = useTranslatedData(auditTypes, { modelName: 'AuditType' });
  const { data: translatedAuditRatings } = useTranslatedData(auditRatings, { modelName: 'AuditScoringRange' });
  const { data: translatedProcesses } = useTranslatedData(processes, { modelName: 'Process' });
  const { data: translatedAuditors } = useTranslatedData(auditors, { modelName: 'User' });
  const { data: translatedAuditees } = useTranslatedData(auditees, { modelName: 'User' });

  if (loading) {
    return (
      <div className="p-3 sm:p-6">
        <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
          <Link href="/internal-audit/audit-planning" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
            <Home className="h-4 w-4" />
            <span>{t("Internal Audit")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <Link href="/internal-audit/audit-planning" className="text-slate-500 hover:text-primary-600 transition-colors">
            {t("Audit Planning")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
          <span className="text-primary-700 font-medium">{t("Edit")}</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("Back")}
          </Button>
          <div className="text-sm text-muted-foreground">{t("Audit Plan")}</div>
          <h1 className="text-xl font-semibold text-slate-900">{t("Edit Audit Plan")}</h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <nav className="flex items-center gap-1.5 text-sm mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap">
        <Link href="/internal-audit/audit-planning" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Internal Audit")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/internal-audit/audit-planning" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Audit Planning")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("Edit")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("Back")}
        </Button>
        <div className="text-sm text-muted-foreground">{t("Audit Plan")}</div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t("Edit Audit Plan")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Engagement Title */}
        <div className="space-y-2">
          <Label className="text-slate-800">
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
          <Label className="text-slate-800">
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
          <Label className="text-slate-800">
            {t("Engagement Scope")} <span className="text-red-500">*</span>
          </Label>
          <Textarea
            value={formData.engagementScope}
            onChange={(e) => setFormData({ ...formData, engagementScope: e.target.value })}
            placeholder={t("Scope")}
            rows={4}
          />
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label className="text-slate-800">
            {t("Department")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.departmentId}
            onValueChange={(value) => setFormData({ ...formData, departmentId: value, linkedRiskIds: [] })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Department")} />
            </SelectTrigger>
            <SelectContent>
              {translatedDepartments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Link Open Risks */}
        <div className="space-y-2">
          <Label className="text-slate-800">
            {t("Link Open Risks in this Department")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.linkedRiskIds[0] || ""}
            onValueChange={(value) => setFormData({ ...formData, linkedRiskIds: [value] })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Risk")} />
            </SelectTrigger>
            <SelectContent>
              {translatedRisks.length > 0 ? (
                translatedRisks.map((risk) => (
                  <SelectItem key={risk.id} value={risk.id}>
                    {risk.riskId} - {risk.riskName}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No open risks found")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Historical Risks */}
        <div className="space-y-2">
          <Label className="text-slate-800">{t("Historical Risks (For reference, last year)")}</Label>
          <div className="border rounded-lg p-4 min-h-[60px] bg-slate-50">
            {translatedHistoricalRisks.length > 0 ? (
              <ul className="space-y-1">
                {translatedHistoricalRisks.map((risk) => (
                  <li key={risk.id} className="text-sm">
                    {risk.riskId} - {risk.riskName} ({risk.riskLevel || t("N/A")})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-center">{t("No items found")}</p>
            )}
          </div>
        </div>

        {/* Process */}
        <div className="space-y-2">
          <Label className="text-slate-800">{t("Process")}</Label>
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

        {/* Audit Rating */}
        <div className="space-y-2">
          <Label className="text-slate-800">{t("Audit Rating")}</Label>
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
                  {t("No ratings configured")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Audit Type */}
        <div className="space-y-2">
          <Label className="text-slate-800">{t("Audit Type")}</Label>
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
                  {t("No audit types configured")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Auditor (Audit Manager) */}
        <div className="space-y-2">
          <Label className="text-slate-800">
            {t("Auditor")} <span className="text-red-500">*</span>
          </Label>
          <Select
            value={formData.auditorId}
            onValueChange={(value) => setFormData({ ...formData, auditorId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Auditor")} />
            </SelectTrigger>
            <SelectContent>
              {translatedAuditors.length > 0 ? (
                translatedAuditors.map((user) => (
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

        {/* Auditee */}
        <div className="space-y-2">
          <Label className="text-slate-800">{t("Auditee")}</Label>
          <Select
            value={formData.auditeeId}
            onValueChange={(value) => setFormData({ ...formData, auditeeId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("Select Auditee")} />
            </SelectTrigger>
            <SelectContent>
              {translatedAuditees.length > 0 ? (
                translatedAuditees.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="none" disabled>
                  {t("No auditees assigned to you")}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <Label className="text-slate-800">
              {t("Start Date")} <span className="text-red-500">*</span>
            </Label>
            <DatePicker
              value={formData.startDate}
              onChange={(date) => setFormData({ ...formData, startDate: date ? formatLocalDate(date) : "" })}
              placeholder={t("Select start date")}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-800">
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
          <Label className="text-slate-800">{t("Attach File")}</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragOverAttach ? "border-primary-500 bg-slate-50" : "border-slate-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverAttach(true); }}
            onDragLeave={() => setIsDragOverAttach(false)}
            onDrop={(e) => handleFileDrop(e, "attach")}
            onClick={() => attachFileRef.current?.click()}
          >
            <p className="text-slate-600">{t("Drag and drop or select file.")}</p>
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
          <Label className="text-slate-800">{t("Upload Workpaper")}</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragOverWorkpaper ? "border-primary-500 bg-slate-50" : "border-slate-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOverWorkpaper(true); }}
            onDragLeave={() => setIsDragOverWorkpaper(false)}
            onDrop={(e) => handleFileDrop(e, "workpaper")}
            onClick={() => workpaperRef.current?.click()}
          >
            <p className="text-slate-600">{t("Drag and drop or select file.")}</p>
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

        {/* Initial Audit Observation */}
        <Collapsible open={observationOpen} onOpenChange={setObservationOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-slate-50 rounded-lg hover:bg-slate-100">
            <span className="text-slate-800 font-medium">{t("Initial Audit Observation")}</span>
            {observationOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="space-y-2">
              <Label className="text-slate-800">{t("Auditor's Initial Observation")}</Label>
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
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-slate-50 rounded-lg hover:bg-slate-100">
            <span className="text-slate-800 font-medium">{t("Audit Testing Procedure")}</span>
            {procedureOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="flex ltr:justify-end rtl:justify-start mb-4">
              <Button type="button" onClick={addTaskRow}>
                <Plus className="h-4 w-4 mr-2" />
                {t("Add Task Row")}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr className="text-left text-slate-800">
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
                          className="border-slate-200"
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
                          className="border-slate-200"
                        />
                      </td>
                      <td className="p-2 border-b">
                        <Input
                          type="number"
                          value={task.actualHours}
                          onChange={(e) => updateTask(task.id, "actualHours", e.target.value)}
                          className="border-slate-200"
                        />
                      </td>
                      <td className="p-2 border-b">
                        <Select
                          value={task.auditorId}
                          onValueChange={(value) => updateTask(task.id, "auditorId", value)}
                        >
                          <SelectTrigger className="border-slate-200">
                            <SelectValue placeholder={t("Select Auditor")} />
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
                      </td>
                      <td className="p-2 border-b">
                        <Input
                          value={task.comments}
                          onChange={(e) => updateTask(task.id, "comments", e.target.value)}
                          className="border-slate-200"
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
                    <td className="p-2 text-slate-800">{t("Total")}: {calculateTotalHours("plannedHours")}</td>
                    <td className="p-2 text-slate-800">{t("Total")}: {calculateTotalHours("actualHours")}</td>
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
          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-slate-50 rounded-lg hover:bg-slate-100">
            <span className="text-slate-800 font-medium">{t("Related Policies & Procedures")}</span>
            {policiesOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 border border-t-0 rounded-b-lg">
            <div className="space-y-2">
              <Label className="text-slate-800">{t("Related Policies / Procedures")}</Label>
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
            onClick={() => router.push("/internal-audit/audit-planning")}
          >
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t("Saving...") : t("Update")}
          </Button>
        </div>
      </form>
    </div>
  );
}
