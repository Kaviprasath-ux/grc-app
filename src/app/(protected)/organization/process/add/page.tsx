"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Upload, FileText, X } from "lucide-react";
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
import { useSession } from "next-auth/react";
import { useUserRoles } from "@/hooks/usePermissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";

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

const processTypes = ["Primary", "Management", "Supporting"];
// natureOfImplementations fetched from API
const operationalComplexities = ["Low", "Medium", "High"];
const getSteps = (t: (key: string) => string) => [
  { step: 1, label: t("Info"), description: t("Basic process information") },
  { step: 2, label: t("Process Flow"), description: t("Process characteristics") },
  { step: 3, label: t("Process RACI"), description: t("Roles and responsibilities") },
];

export default function AddProcessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRoles = useUserRoles();
  const { t } = useLanguage();

  // Check if user is DepartmentContributor - they can only add processes in their department
  const isDepartmentContributor = userRoles.some((role) => role === "DepartmentContributor");
  const userDepartmentId = session?.user?.departmentId;

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processFrequencies, setProcessFrequencies] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<MultiSelectOption[]>([]);
  const [natureOfImplementations, setNatureOfImplementations] = useState<string[]>([]);

  // File upload states
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingOnboardingFiles, setPendingOnboardingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isOnboardingDragging, setIsOnboardingDragging] = useState(false);
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, userRes, freqRes, locRes, implRes] = await Promise.all([
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
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // Auto-select department for DepartmentContributor
  useEffect(() => {
    if (isDepartmentContributor && userDepartmentId && !formData.departmentId) {
      setFormData((prev) => ({ ...prev, departmentId: userDepartmentId }));
    }
  }, [isDepartmentContributor, userDepartmentId, formData.departmentId]);

  // File upload handlers
  const formatFileSize = (bytes: number): string => {
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, files[0]]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFiles((prev) => [...prev, file]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
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

  const handleOnboardingDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOnboardingDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setPendingOnboardingFiles((prev) => [...prev, ...files]);
    }
  };

  const handleOnboardingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setPendingOnboardingFiles((prev) => [...prev, ...Array.from(files)]);
    }
    if (onboardingFileInputRef.current) {
      onboardingFileInputRef.current.value = "";
    }
  };

  const removeOnboardingFile = (index: number) => {
    setPendingOnboardingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (processId: string) => {
    for (const file of pendingFiles) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", "process_document");
        await fetch(`/api/processes/${processId}/attachments`, {
          method: "POST",
          body: fd,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
    for (const file of pendingOnboardingFiles) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", "employee_onboarding");
        await fetch(`/api/processes/${processId}/attachments`, {
          method: "POST",
          body: fd,
        });
      } catch (error) {
        console.error("Error uploading onboarding file:", error);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: t("Error"), description: t("Process Name is required"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
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
        const process = await res.json();

        // Upload pending files if any
        if (pendingFiles.length > 0 || pendingOnboardingFiles.length > 0) {
          await uploadFiles(process.id);
        }

        toast({ title: t("Success"), description: t("Process created successfully") });
        router.push("/organization/process");
      } else {
        const error = await res.json();
        toast({ title: t("Error"), description: error.error || t("Failed to create process"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Error creating process:", error);
      toast({ title: t("Error"), description: t("Failed to create process"), variant: "destructive" });
    }
    setSaving(false);
  };

  const steps = getSteps(t);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4 ltr:mr-1 rtl:ml-1" />
          {t("Back")}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("New Process")}</h1>
          <p className="text-muted-foreground text-sm">{t("Complete the form to create a new process")}</p>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((item, index) => (
            <div key={item.step} className="flex items-center flex-1">
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
            <div className="space-y-2">
              <Label htmlFor="name">{t("Process Name")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t("Enter process name")}
              />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("Department")}</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value, ownerId: "" })}
                  disabled={isDepartmentContributor}
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

            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
              <Input
                id="lastAuditDate"
                type="date"
                value={formData.lastAuditDate}
                onChange={(e) => setFormData({ ...formData, lastAuditDate: e.target.value })}
              />
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="assetDependency"
                  checked={formData.assetDependency}
                  onCheckedChange={(checked) => setFormData({ ...formData, assetDependency: !!checked })}
                />
                <Label htmlFor="assetDependency" className="text-sm font-normal">{t("Asset Dependency")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="externalDependency"
                  checked={formData.externalDependency}
                  onCheckedChange={(checked) => setFormData({ ...formData, externalDependency: !!checked })}
                />
                <Label htmlFor="externalDependency" className="text-sm font-normal">{t("External Dependency")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpiMeasurementRequired"
                  checked={formData.kpiMeasurementRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, kpiMeasurementRequired: !!checked })}
                />
                <Label htmlFor="kpiMeasurementRequired" className="text-sm font-normal">{t("KPI Measurement Required")}</Label>
              </div>
              <div className="flex items-center space-x-2">
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
              <p className="text-sm text-muted-foreground">
                {t("Add files to attach to this process. Files will be uploaded when you save.")}
              </p>

              {/* File Dropper */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {t("Drag and drop a file here, or")}{" "}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:underline font-medium"
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
              </div>

              {/* Pending Files List */}
              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("Files to Upload")} ({pendingFiles.length})</Label>
                  <div className="border rounded-lg divide-y">
                    {pendingFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t("Remove")}
                          onClick={() => removePendingFile(index)}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
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
                  isOnboardingDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={handleOnboardingDragOver}
                onDragLeave={handleOnboardingDragLeave}
                onDrop={handleOnboardingDrop}
              >
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-gray-400" />
                  <p className="text-sm text-gray-600">
                    {t("Drag and drop files here, or")}{" "}
                    <button
                      type="button"
                      onClick={() => onboardingFileInputRef.current?.click()}
                      className="text-blue-600 hover:underline font-medium"
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
              </div>

              {pendingOnboardingFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("Onboarding Files to Upload")} ({pendingOnboardingFiles.length})</Label>
                  <div className="border rounded-lg divide-y">
                    {pendingOnboardingFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t("Remove")}
                          onClick={() => removeOnboardingFile(index)}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
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
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
        <div className="flex justify-between mt-8 pt-6 border-t">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                {t("Previous")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/organization/process")}>
              {t("Cancel")}
            </Button>
            {currentStep < 3 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)}>
                {t("Next")}
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t("Saving...") : t("Save")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
