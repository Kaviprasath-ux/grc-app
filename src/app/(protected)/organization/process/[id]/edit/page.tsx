"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { isValidName } from "@/lib/validations";
import { ChevronLeft, ChevronRight, Check, Upload, FileText, Eye, Download, Trash2, X } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { DatePicker } from "@/components/ui/date-picker";
import { useTranslatedData, triggerTranslation } from "@/hooks/useTranslatedData";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  departmentId?: string | null;
  userRoles?: { role: { name: string } }[];
}

interface ProcessAttachment {
  id: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  filePath: string;
  category: string;
  uploadedAt: string;
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
  processType: string;
  departmentId: string | null;
  ownerId: string | null;
  status: string;
  processFrequency?: string | null;
  natureOfImplementation?: string | null;
  assetDependency?: boolean;
  externalDependency?: boolean;
  location?: string | null;
  kpiMeasurementRequired?: boolean;
  piiCapture?: boolean;
  operationalComplexity?: string | null;
  lastAuditDate?: string | null;
  responsibleId?: string | null;
  accountableId?: string | null;
  consultedId?: string | null;
  informedId?: string | null;
  attachments?: ProcessAttachment[];
}

const processTypes = ["Primary", "Management", "Supporting"];
// natureOfImplementations fetched from API
const operationalComplexities = ["Low", "Medium", "High"];
const getSteps = (t: (key: string) => string) => [
  { step: 1, label: t("Info"), description: t("Basic process information") },
  { step: 2, label: t("Process Flow"), description: t("Process characteristics") },
  { step: 3, label: t("Process RACI"), description: t("Roles and responsibilities") },
];

export default function EditProcessPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { t, isRTL } = useLanguage();
  const processId = params.id as string;

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rawProcess, setRawProcess] = useState<Process | null>(null);
  const formInitializedRef = useRef(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processFrequencies, setProcessFrequencies] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<MultiSelectOption[]>([]);
  const [natureOfImplementations, setNatureOfImplementations] = useState<string[]>([]);

  // File upload states
  const [attachments, setAttachments] = useState<ProcessAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isOnboardingDragging, setIsOnboardingDragging] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingOnboardingFile, setUploadingOnboardingFile] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onboardingFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    processCode: "",
    name: "",
    description: "",
    processType: "Primary",
    departmentId: "",
    ownerId: "",
    status: "Active",
    frequency: "",
    natureOfImplementation: "",
    assetDependency: false,
    externalDependency: false,
    location: [] as string[],
    kpiMeasurementRequired: false,
    piiCapture: false,
    operationalComplexity: "",
    lastAuditDate: "",
    responsible: "",
    accountable: "",
    consulted: "",
    informed: "",
  });

  // Translate the loaded process so form shows current locale values
  const processArray = rawProcess ? [rawProcess] : [];
  const { data: translatedProcessArray, isLoading: translationsLoading } = useTranslatedData(processArray, { modelName: 'Process' });

  // Populate form with translated values when translations arrive
  useEffect(() => {
    if (translatedProcessArray.length > 0 && rawProcess && !translationsLoading && !formInitializedRef.current) {
      const tp = translatedProcessArray[0];
      setFormData(prev => ({
        ...prev,
        name: tp.name || prev.name,
        description: tp.description || prev.description,
      }));
      formInitializedRef.current = true;
    }
  }, [translatedProcessArray, rawProcess, translationsLoading]);

  const fetchData = useCallback(async () => {
    if (!processId) return;

    setLoading(true);
    try {
      const [processRes, deptRes, userRes, freqRes, locRes, implRes] = await Promise.all([
        fetch(`/api/processes/${processId}`),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/organization-settings/process-frequency"),
        fetch("/api/organization-settings/location"),
        fetch("/api/organization-settings/nature-of-implementation"),
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (userRes.ok) setUsers(await userRes.json());
      if (freqRes.ok) {
        const freqData = await freqRes.json();
        setProcessFrequencies(freqData.map((f: { name: string }) => f.name));
      }
      if (locRes.ok) {
        const locData = await locRes.json();
        setLocationOptions(locData.map((l: { id: string; name: string }) => ({ value: l.name, label: l.name })));
      }
      if (implRes.ok) {
        const implData = await implRes.json();
        setNatureOfImplementations(implData.map((i: { name: string }) => i.name));
      }

      if (processRes.ok) {
        const process: Process = await processRes.json();
        console.log("Fetched process:", process);
        setRawProcess(process);
        formInitializedRef.current = false;
        setFormData({
          processCode: process.processCode || "",
          name: process.name || "",
          description: process.description || "",
          processType: process.processType || "Primary",
          departmentId: process.departmentId || "",
          ownerId: process.ownerId || "",
          status: process.status || "Active",
          frequency: process.processFrequency || "",
          natureOfImplementation: process.natureOfImplementation || "",
          assetDependency: process.assetDependency ?? false,
          externalDependency: process.externalDependency ?? false,
          location: (() => { try { return process.location ? JSON.parse(process.location) : []; } catch { return []; } })(),
          kpiMeasurementRequired: process.kpiMeasurementRequired ?? false,
          piiCapture: process.piiCapture ?? false,
          operationalComplexity: process.operationalComplexity || "",
          lastAuditDate: process.lastAuditDate?.split("T")[0] || "",
          responsible: process.responsibleId || "",
          accountable: process.accountableId || "",
          consulted: process.consultedId || "",
          informed: process.informedId || "",
        });
        // Set attachments
        setAttachments(process.attachments || []);
      } else {
        console.error("Failed to fetch process:", await processRes.text());
        toast({ title: t("Error"), description: t("Failed to load process data"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: t("Error"), description: t("Failed to load data"), variant: "destructive" });
    }
    setLoading(false);
  }, [processId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // File upload handlers
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await uploadFile(files[0], "process_document");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file, "process_document");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Onboarding file handlers
  const handleOnboardingDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOnboardingDragging(true);
  };

  const handleOnboardingDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOnboardingDragging(false);
  };

  const handleOnboardingDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsOnboardingDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      await uploadFile(file, "employee_onboarding");
    }
  };

  const handleOnboardingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (const file of Array.from(files)) {
        await uploadFile(file, "employee_onboarding");
      }
    }
    if (onboardingFileInputRef.current) {
      onboardingFileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File, category: string) => {
    const isOnboarding = category === "employee_onboarding";
    if (isOnboarding) setUploadingOnboardingFile(true);
    else setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);

      const res = await fetch(`/api/processes/${processId}/attachments`, {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        const attachment = await res.json();
        setAttachments((prev) => [attachment, ...prev]);
        toast({ title: t("Success"), description: t("File uploaded successfully") });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to upload file"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({ title: t("Error"), description: t("Failed to upload file"), variant: "destructive" });
    }
    if (isOnboarding) setUploadingOnboardingFile(false);
    else setUploadingFile(false);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    setDeletingAttachmentId(attachmentId);
    try {
      const res = await fetch(`/api/processes/${processId}/attachments/${attachmentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        toast({ title: t("Success"), description: t("Attachment deleted successfully") });
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to delete attachment"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast({ title: t("Error"), description: t("Failed to delete attachment"), variant: "destructive" });
    }
    setDeletingAttachmentId(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: t("Error"), description: t("Process Name is required"), variant: "destructive" });
      return;
    }
    if (!isValidName(formData.name.trim())) {
      toast({ title: t("Error"), description: t("Only letters, spaces, and hyphens are allowed"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/processes/${processId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          processType: formData.processType,
          departmentId: formData.departmentId || null,
          ownerId: formData.ownerId || null,
          status: formData.status,
          processFrequency: formData.frequency || null,
          natureOfImplementation: formData.natureOfImplementation || null,
          assetDependency: formData.assetDependency,
          externalDependency: formData.externalDependency,
          location: formData.location.length > 0 ? JSON.stringify(formData.location) : null,
          kpiMeasurementRequired: formData.kpiMeasurementRequired,
          piiCapture: formData.piiCapture,
          operationalComplexity: formData.operationalComplexity || null,
          lastAuditDate: formData.lastAuditDate || null,
          responsibleId: formData.responsible || null,
          accountableId: formData.accountable || null,
          consultedId: formData.consulted || null,
          informedId: formData.informed || null,
        }),
      });

      if (res.ok) {
        triggerTranslation('Process', processId, { name: formData.name, description: formData.description });
        toast({ title: t("Success"), description: t("Process updated successfully") });
        router.push("/organization/process");
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to update process"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating process:", error);
      toast({ title: t("Error"), description: t("Failed to update process"), variant: "destructive" });
    }
    setSaving(false);
  };

  const steps = getSteps(t);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{t("Loading...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className={isRTL ? "flex-row-reverse" : ""}
        >
          <ChevronLeft className={`h-4 w-4 ltr:mr-1 rtl:ml-1 ${isRTL ? "rotate-180" : ""}`} />
          {t("Back")}
        </Button>
        <div className={isRTL ? "text-right" : ""}>
          <h1 className="text-xl sm:text-2xl font-bold">{t("Edit Process")}</h1>
          <p className="text-muted-foreground text-sm">{formData.processCode} - {formData.name}</p>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="bg-white rounded-lg border shadow-sm p-3 sm:p-6" style={isRTL ? { direction: 'rtl' } : undefined}>
        <div className={`flex items-center justify-between mb-8 ${isRTL ? "flex-row-reverse" : ""}`}>
          {steps.map((item, index) => (
            <div key={item.step} className={`flex items-center flex-1 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                    currentStep > item.step
                      ? "bg-success border-success text-white"
                      : currentStep === item.step
                      ? "bg-primary-600 border-primary-600 text-white"
                      : "bg-white border-slate-300 text-slate-500"
                  }`}
                >
                  {currentStep > item.step ? <Check className="h-5 w-5" /> : item.step}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${currentStep >= item.step ? "text-primary-600" : "text-slate-500"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground hidden md:block">{item.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${currentStep > item.step ? "bg-success" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="processCode">{t("Process ID")}</Label>
                <Input
                  id="processCode"
                  value={formData.processCode}
                  disabled
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t("Process Name")} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("Enter process name")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("Description")}</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t("Enter description")}
                className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Process Type")}</Label>
                <Select
                  value={formData.processType}
                  onValueChange={(value) => setFormData({ ...formData, processType: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select Process Type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {processTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("Status")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select Status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">{t("Active")}</SelectItem>
                    <SelectItem value="Inactive">{t("Inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Department")}</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value, ownerId: "" })}
                >
                  <SelectTrigger className="bg-white">
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
              <div className="space-y-2">
                <Label>{t("Process Owner")}</Label>
                <Select
                  value={formData.ownerId}
                  onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                  disabled={!formData.departmentId}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={formData.departmentId ? t("Select Owner") : t("Select department first")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((user) => user.departmentId === formData.departmentId && user.userRoles?.some((ur) => ur.role.name === "DepartmentReviewer")).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Process Frequency")}</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select Frequency")} />
                  </SelectTrigger>
                  <SelectContent>
                    {processFrequencies.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {t(freq)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("Nature of Implementation")}</Label>
                <Select
                  value={formData.natureOfImplementation}
                  onValueChange={(value) => setFormData({ ...formData, natureOfImplementation: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select Nature")} />
                  </SelectTrigger>
                  <SelectContent>
                    {natureOfImplementations.map((nature) => (
                      <SelectItem key={nature} value={nature}>
                        {t(nature)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>
        )}

        {/* Step 2: Process Flow */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Location")}</Label>
                <MultiSelect
                  options={locationOptions}
                  selected={formData.location}
                  onChange={(selected) => setFormData({ ...formData, location: selected })}
                  placeholder={t("Select locations")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Operational Complexity")}</Label>
                <Select
                  value={formData.operationalComplexity}
                  onValueChange={(value) => setFormData({ ...formData, operationalComplexity: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select Complexity")} />
                  </SelectTrigger>
                  <SelectContent>
                    {operationalComplexities.map((comp) => (
                      <SelectItem key={comp} value={comp}>
                        {t(comp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastAuditDate">{t("Last Audit Date")}</Label>
              <DatePicker
                value={formData.lastAuditDate}
                onChange={(date) => setFormData({ ...formData, lastAuditDate: date ? date.toISOString().split("T")[0] : "" })}
                placeholder={t("Select date")}
              />
            </div>

            <div className="space-y-4 pt-4">
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Checkbox
                  id="assetDependency"
                  checked={formData.assetDependency}
                  onCheckedChange={(checked) => setFormData({ ...formData, assetDependency: !!checked })}
                />
                <Label htmlFor="assetDependency" className="text-sm font-normal">{t("Asset Dependency")}</Label>
              </div>
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Checkbox
                  id="externalDependency"
                  checked={formData.externalDependency}
                  onCheckedChange={(checked) => setFormData({ ...formData, externalDependency: !!checked })}
                />
                <Label htmlFor="externalDependency" className="text-sm font-normal">{t("External Dependency")}</Label>
              </div>
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Checkbox
                  id="kpiMeasurementRequired"
                  checked={formData.kpiMeasurementRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, kpiMeasurementRequired: !!checked })}
                />
                <Label htmlFor="kpiMeasurementRequired" className="text-sm font-normal">{t("KPI Measurement Required")}</Label>
              </div>
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Checkbox
                  id="piiCapture"
                  checked={formData.piiCapture}
                  onCheckedChange={(checked) => setFormData({ ...formData, piiCapture: !!checked })}
                />
                <Label htmlFor="piiCapture" className="text-sm font-normal">{t("PII Capture")}</Label>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="space-y-4 pt-6 border-t">
              <Label className="text-base font-medium">{t("Process Documents")}</Label>

              {/* File Dropper */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {uploadingFile ? (
                  <div className="space-y-2">
                    <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-muted-foreground">{t("Uploading...")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-slate-400" />
                    <p className="text-sm text-slate-600">
                      {t("Drag and drop a file here, or")}{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary-600 hover:underline font-medium"
                      >
                        {t("browse")}
                      </button>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("Supported formats: PDF, DOCX, XLSX, CSV, PNG, JPG, PPT")}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.ppt,.pptx"
                    />
                  </div>
                )}
              </div>

              {/* Uploaded Files List */}
              {attachments.filter((a) => a.category !== "employee_onboarding").length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("Uploaded Files")}</Label>
                  <div className="border rounded-lg divide-y">
                    {attachments.filter((a) => a.category !== "employee_onboarding").map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary-600" />
                          <div>
                            <p className="text-sm font-medium">{attachment.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.fileSize)} - {t("Uploaded")} {new Date(attachment.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t("View")}
                            onClick={() => window.open(attachment.filePath, "_blank")}
                          >
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>
                          <a
                            href={attachment.filePath}
                            download={attachment.fileName}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100"
                            title={t("Download")}
                          >
                            <Download className="h-4 w-4 text-slate-600" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t("Delete")}
                            disabled={deletingAttachmentId === attachment.id}
                            onClick={() => handleDeleteAttachment(attachment.id)}
                          >
                            {deletingAttachmentId === attachment.id ? (
                              <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Employee Onboarding Section */}
            <div className="space-y-4 pt-6 border-t">
              <Label className="text-base font-medium">{t("Employee Onboarding")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("Upload employee onboarding documents for this process. Multiple files can be attached.")}
              </p>

              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isOnboardingDragging ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={handleOnboardingDragOver}
                onDragLeave={handleOnboardingDragLeave}
                onDrop={handleOnboardingDrop}
              >
                {uploadingOnboardingFile ? (
                  <div className="space-y-2">
                    <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-muted-foreground">{t("Uploading...")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-10 w-10 mx-auto text-slate-400" />
                    <p className="text-sm text-slate-600">
                      {t("Drag and drop files here, or")}{" "}
                      <button
                        type="button"
                        onClick={() => onboardingFileInputRef.current?.click()}
                        className="text-primary-600 hover:underline font-medium"
                      >
                        {t("browse")}
                      </button>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("Supported formats: PDF, DOCX, XLSX, CSV, PNG, JPG, PPT")}
                    </p>
                    <input
                      ref={onboardingFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleOnboardingFileChange}
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.ppt,.pptx"
                    />
                  </div>
                )}
              </div>

              {attachments.filter((a) => a.category === "employee_onboarding").length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("Onboarding Files")}</Label>
                  <div className="border rounded-lg divide-y">
                    {attachments.filter((a) => a.category === "employee_onboarding").map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{attachment.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.fileSize)} - {t("Uploaded")} {new Date(attachment.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t("View")}
                            onClick={() => window.open(attachment.filePath, "_blank")}
                          >
                            <Eye className="h-4 w-4 text-slate-600" />
                          </Button>
                          <a
                            href={attachment.filePath}
                            download={attachment.fileName}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100"
                            title={t("Download")}
                          >
                            <Download className="h-4 w-4 text-slate-600" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={t("Delete")}
                            disabled={deletingAttachmentId === attachment.id}
                            onClick={() => handleDeleteAttachment(attachment.id)}
                          >
                            {deletingAttachmentId === attachment.id ? (
                              <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-600" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Process RACI */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              {t("Define the RACI matrix for this process - who is Responsible, Accountable, Consulted, and Informed.")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Responsible")}</Label>
                <Select
                  value={formData.responsible}
                  onValueChange={(value) => setFormData({ ...formData, responsible: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select user")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("Person who does the work")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("Accountable")}</Label>
                <Select
                  value={formData.accountable}
                  onValueChange={(value) => setFormData({ ...formData, accountable: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select user")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("Person ultimately answerable")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Consulted")}</Label>
                <Select
                  value={formData.consulted}
                  onValueChange={(value) => setFormData({ ...formData, consulted: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select user")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("Person whose input is sought")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("Informed")}</Label>
                <Select
                  value={formData.informed}
                  onValueChange={(value) => setFormData({ ...formData, informed: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={t("Select user")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u) => !u.userRoles?.some((ur) => ur.role.name === "CustomerAdministrator")).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("Person kept up-to-date on progress")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className={`flex items-center gap-3 mt-8 pt-6 border-t ${isRTL ? "flex-row-reverse" : ""}`}>
          <span className={`text-xs font-medium text-slate-400 ${isRTL ? "ms-auto" : "me-auto"}`}>
            {t("Step")} {currentStep} {t("of")} 3
          </span>
          <Button
            variant="outline"
            className={isRTL ? "flex-row-reverse" : ""}
            onClick={() => {
              if (currentStep === 1) {
                router.push("/organization/process");
              } else {
                setCurrentStep(currentStep - 1);
              }
            }}
          >
            {currentStep > 1 && <ChevronLeft className={`h-4 w-4 me-1 ${isRTL ? "rotate-180" : ""}`} />}
            {currentStep === 1 ? t("Cancel") : t("Previous")}
          </Button>
          {currentStep < 3 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)} className={isRTL ? "flex-row-reverse" : ""}>
              {t("Next")}
              <ChevronRight className={`h-4 w-4 ms-1 ${isRTL ? "rotate-180" : ""}`} />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("Saving...") : t("Save Changes")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
