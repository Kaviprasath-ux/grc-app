"use client";

import { useEffect, useState } from "react";
import { formatLocalDate } from "@/lib/utils";
import { isValidName } from "@/lib/validations";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { useLanguage } from "@/contexts/LanguageContext";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  userRoles?: { role: { name: string } }[];
}

interface ProcessFrequency {
  id: string;
  name: string;
}

interface NatureOfImplementation {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  name: string;
}

interface Stakeholder {
  id: string;
  name: string;
  type: string;
}

const OPERATIONAL_COMPLEXITIES = ["Low", "Medium", "High"];
const RECURRENCE_OPTIONS = ["Daily", "Weekly", "Monthly", "Quarterly", "Annually"];

export default function NewProcessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processFrequencies, setProcessFrequencies] = useState<ProcessFrequency[]>([]);
  const [natureOfImplementations, setNatureOfImplementations] = useState<NatureOfImplementation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nextProcessId, setNextProcessId] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Dialog states
  const [showFrequencyDialog, setShowFrequencyDialog] = useState(false);
  const [showNatureDialog, setShowNatureDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [newFrequency, setNewFrequency] = useState("");
  const [newNature, setNewNature] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);
  const [frequencyError, setFrequencyError] = useState("");
  const [natureError, setNatureError] = useState("");
  const [locationError, setLocationError] = useState("");

  const TOTAL_STEPS = 3;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    assetId: "",
    externalDependency: false,
    externalParty: "",
    kpiMeasurementRequired: false,
    piiCapture: false,
    recurrence: "",
    reviewDate: "",
    operationalComplexity: "",
    lastAuditDate: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [processesRes, departmentsRes, usersRes, frequenciesRes, natureRes, locationsRes, assetsRes, stakeholdersRes] = await Promise.all([
        fetch("/api/processes"),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/internal-audit/process-frequency"),
        fetch("/api/internal-audit/nature-of-implementation"),
        fetch("/api/internal-audit/locations"),
        fetch("/api/assets"),
        fetch("/api/stakeholders"),
      ]);

      if (processesRes.ok) {
        const data = await processesRes.json();
        const maxId = data.reduce((max: number, p: { processCode?: string }) => {
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

      if (frequenciesRes.ok) {
        setProcessFrequencies(await frequenciesRes.json());
      }

      if (natureRes.ok) {
        setNatureOfImplementations(await natureRes.json());
      }

      if (locationsRes.ok) {
        setLocations(await locationsRes.json());
      }

      if (assetsRes.ok) {
        setAssets(await assetsRes.json());
      }

      if (stakeholdersRes.ok) {
        setStakeholders(await stakeholdersRes.json());
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = t("Process Name is required");
    else if (!isValidName(formData.name.trim())) errors.name = t("Only letters, spaces, and hyphens are allowed");
    if (!formData.ownerId) errors.ownerId = t("Process Owner is required");
    if (!formData.processFrequency) errors.processFrequency = t("Process Frequency is required");
    if (!formData.natureOfImplementation) errors.natureOfImplementation = t("Nature of Implementation is required");
    if (!formData.location) errors.location = t("Location is required");
    if (!formData.operationalComplexity) errors.operationalComplexity = t("Operational Complexity is required");
    if (!formData.lastAuditDate) errors.lastAuditDate = t("Last Audit Date is required");
    setFieldErrors(errors);
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

  const handleSave = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      toast({ title: t("Error"), description: t("Please fill all required fields in Step 1"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body = {
        ...formData,
        processCode: nextProcessId,
        departmentId: formData.departmentId || null,
        ownerId: formData.ownerId || null,
        lastAuditDate: formData.lastAuditDate || null,
        responsibleId: formData.responsibleId || null,
        accountableId: formData.accountableId || null,
        consultedId: formData.consultedId || null,
        informedId: formData.informedId || null,
      };

      const response = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({ title: t("Success"), description: t("Process created successfully!") });
        router.push("/internal-audit/settings/process");
      } else {
        const errorData = await response.json();
        toast({ title: t("Error"), description: `${t("Failed to save process")}: ${errorData.error || t("Unknown error")}`, variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: t("Error"), description: t("An error occurred while saving the process"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddFrequency = async () => {
    if (!newFrequency.trim()) {
      setFrequencyError(t("Please enter a frequency name"));
      return;
    }

    setDialogSaving(true);
    try {
      const response = await fetch("/api/internal-audit/process-frequency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFrequency }),
      });

      if (response.ok) {
        const created = await response.json();
        setProcessFrequencies(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setFormData(prev => ({ ...prev, processFrequency: created.name }));
        setShowFrequencyDialog(false);
        setNewFrequency("");
        toast({ title: t("Success"), description: t("Process frequency added successfully!") });
      } else {
        const errorData = await response.json();
        toast({ title: t("Error"), description: errorData.error || t("Failed to add process frequency"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to add frequency:", error);
      toast({ title: t("Error"), description: t("An error occurred"), variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleAddNature = async () => {
    if (!newNature.trim()) {
      setNatureError(t("Please enter a nature of implementation"));
      return;
    }

    setDialogSaving(true);
    try {
      const response = await fetch("/api/internal-audit/nature-of-implementation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newNature }),
      });

      if (response.ok) {
        const created = await response.json();
        setNatureOfImplementations(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setFormData(prev => ({ ...prev, natureOfImplementation: created.name }));
        setShowNatureDialog(false);
        setNewNature("");
        toast({ title: t("Success"), description: t("Nature of implementation added successfully!") });
      } else {
        const errorData = await response.json();
        toast({ title: t("Error"), description: errorData.error || t("Failed to add nature of implementation"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to add nature:", error);
      toast({ title: t("Error"), description: t("An error occurred"), variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.trim()) {
      setLocationError(t("Please enter a location name"));
      return;
    }

    setDialogSaving(true);
    try {
      const response = await fetch("/api/internal-audit/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newLocation }),
      });

      if (response.ok) {
        const created = await response.json();
        setLocations(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setFormData(prev => ({ ...prev, location: created.name }));
        setShowLocationDialog(false);
        setNewLocation("");
        toast({ title: t("Success"), description: t("Location added successfully!") });
      } else {
        const errorData = await response.json();
        toast({ title: t("Error"), description: errorData.error || t("Failed to add location"), variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to add location:", error);
      toast({ title: t("Error"), description: t("An error occurred"), variant: "destructive" });
    } finally {
      setDialogSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/internal-audit/settings/process")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("New Process")}</h1>
          <p className="text-gray-600">{t("Create a new audit process")}</p>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-card rounded-lg border">
        <div className="p-3 sm:p-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-6 sm:mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 text-sm ${
                  step === currentStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : step < currentStep
                    ? "bg-primary/20 border-primary"
                    : "border-gray-300"
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-12 sm:w-24 h-0.5 ${step < currentStep ? "bg-primary" : "bg-gray-300"}`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-center mb-4 sm:mb-6">{getStepTitle()}</h2>

          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("Process ID")}</Label>
                  <Input value={nextProcessId} disabled className="mt-2 bg-muted" />
                </div>
                <div>
                  <Label htmlFor="name">{t("Process Name")} <span className="text-red-500">*</span></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setFieldErrors(prev => ({ ...prev, name: "" })); }}
                    placeholder={t("Enter Process Name")}
                    className={`mt-2 ${fieldErrors.name ? "border-red-500" : ""}`}
                  />
                  {fieldErrors.name && <p className="text-sm text-red-500 mt-1">{fieldErrors.name}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="description">{t("Description")}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("Enter Description")}
                  className="mt-2"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("Department")}</Label>
                  <Select
                    value={formData.departmentId}
                    onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                  >
                    <SelectTrigger className="mt-2">
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
                <div>
                  <Label>{t("Process Owner")} <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.ownerId}
                    onValueChange={(value) => { setFormData({ ...formData, ownerId: value }); setFieldErrors(prev => ({ ...prev, ownerId: "" })); }}
                  >
                    <SelectTrigger className={`mt-2 ${fieldErrors.ownerId ? "border-red-500" : ""}`}>
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
                  {fieldErrors.ownerId && <p className="text-sm text-red-500 mt-1">{fieldErrors.ownerId}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("Process Frequency")} <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2 mt-2">
                    <Select
                      value={formData.processFrequency}
                      onValueChange={(value) => { setFormData({ ...formData, processFrequency: value }); setFieldErrors(prev => ({ ...prev, processFrequency: "" })); }}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.processFrequency ? "border-red-500" : ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {processFrequencies.map((f) => (
                          <SelectItem key={f.id} value={f.name}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowFrequencyDialog(true)}
                      title={t("Add Process Frequency")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {fieldErrors.processFrequency && <p className="text-sm text-red-500 mt-1">{fieldErrors.processFrequency}</p>}
                </div>
                <div>
                  <Label>{t("Nature of Implementation")} <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2 mt-2">
                    <Select
                      value={formData.natureOfImplementation}
                      onValueChange={(value) => { setFormData({ ...formData, natureOfImplementation: value }); setFieldErrors(prev => ({ ...prev, natureOfImplementation: "" })); }}
                    >
                      <SelectTrigger className={`flex-1 ${fieldErrors.natureOfImplementation ? "border-red-500" : ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {natureOfImplementations.map((n) => (
                          <SelectItem key={n.id} value={n.name}>
                            {n.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNatureDialog(true)}
                      title={t("Add Nature of Implementation")}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {fieldErrors.natureOfImplementation && <p className="text-sm text-red-500 mt-1">{fieldErrors.natureOfImplementation}</p>}
                </div>
              </div>

              <div>
                <Label>{t("Location")} <span className="text-red-500">*</span></Label>
                <div className="flex gap-2 mt-2">
                  <Select
                    value={formData.location}
                    onValueChange={(value) => { setFormData({ ...formData, location: value }); setFieldErrors(prev => ({ ...prev, location: "" })); }}
                  >
                    <SelectTrigger className={`flex-1 ${fieldErrors.location ? "border-red-500" : ""}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.name}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowLocationDialog(true)}
                    title={t("Add Location")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {fieldErrors.location && <p className="text-sm text-red-500 mt-1">{fieldErrors.location}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Checkbox
                      id="assetDependency"
                      checked={formData.assetDependency}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, assetDependency: checked as boolean, assetId: checked ? formData.assetId : "" })
                      }
                    />
                    <Label htmlFor="assetDependency" className="cursor-pointer">
                      {t("Asset Dependency")}
                    </Label>
                  </div>
                  {formData.assetDependency && (
                    <div className="ltr:ml-6 rtl:mr-6">
                      <Label>{t("Select Asset")}</Label>
                      <Select
                        value={formData.assetId}
                        onValueChange={(value) => setFormData({ ...formData, assetId: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={t("Select Asset")} />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Checkbox
                      id="externalDependency"
                      checked={formData.externalDependency}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, externalDependency: checked as boolean, externalParty: checked ? formData.externalParty : "" })
                      }
                    />
                    <Label htmlFor="externalDependency" className="cursor-pointer">
                      {t("External Dependency")}
                    </Label>
                  </div>
                  {formData.externalDependency && (
                    <div className="ltr:ml-6 rtl:mr-6">
                      <Label>{t("Stakeholder")}</Label>
                      <Select
                        value={formData.externalParty}
                        onValueChange={(value) => setFormData({ ...formData, externalParty: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder={t("Select Stakeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {stakeholders.map((stakeholder) => (
                            <SelectItem key={stakeholder.id} value={stakeholder.name}>
                              {stakeholder.name} {stakeholder.type && `(${stakeholder.type})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
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
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
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

              {/* Conditional fields: Recurrence and Review Date (shown when KPI or PII is checked) */}
              {(formData.kpiMeasurementRequired || formData.piiCapture) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
                  <div>
                    <Label>{t("Recurrence")}</Label>
                    <Select
                      value={formData.recurrence}
                      onValueChange={(value) => setFormData({ ...formData, recurrence: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder={t("Select Recurrence")} />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="reviewDate">{t("Review Date")}</Label>
                    <DatePicker
                      value={formData.reviewDate}
                      onChange={(date) => setFormData({ ...formData, reviewDate: date ? formatLocalDate(date) : "" })}
                      placeholder={t("Select date")}
                      className="mt-2"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>{t("Operational Complexity")} <span className="text-red-500">*</span></Label>
                  <Select
                    value={formData.operationalComplexity}
                    onValueChange={(value) => { setFormData({ ...formData, operationalComplexity: value }); setFieldErrors(prev => ({ ...prev, operationalComplexity: "" })); }}
                  >
                    <SelectTrigger className={`mt-2 ${fieldErrors.operationalComplexity ? "border-red-500" : ""}`}>
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
                  {fieldErrors.operationalComplexity && <p className="text-sm text-red-500 mt-1">{fieldErrors.operationalComplexity}</p>}
                </div>
                <div>
                  <Label htmlFor="lastAuditDate">{t("Last Audit Date")} <span className="text-red-500">*</span></Label>
                  <DatePicker
                    value={formData.lastAuditDate}
                    onChange={(date) => { setFormData({ ...formData, lastAuditDate: date ? formatLocalDate(date) : "" }); setFieldErrors(prev => ({ ...prev, lastAuditDate: "" })); }}
                    placeholder={t("Select date")}
                    className={`mt-2 ${fieldErrors.lastAuditDate ? "[&>button]:border-red-500" : ""}`}
                  />
                  {fieldErrors.lastAuditDate && <p className="text-sm text-red-500 mt-1">{fieldErrors.lastAuditDate}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add Documents */}
          {currentStep === 2 && (
            <div className="max-w-4xl mx-auto space-y-4">
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
            </div>
          )}

          {/* Step 3: RACI Assignment */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto space-y-6">
              {(() => {
                // Filter out CustomerAdministrator users for RACI dropdowns
                const raciUsers = users.filter(user =>
                  !user.userRoles?.some(ur => ur.role.name === "CustomerAdministrator")
                );
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>{t("Responsible")}</Label>
                        <Select
                          value={formData.responsibleId}
                          onValueChange={(value) => setFormData({ ...formData, responsibleId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder={t("Select Responsible")} />
                          </SelectTrigger>
                          <SelectContent>
                            {raciUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t("Accountable")}</Label>
                        <Select
                          value={formData.accountableId}
                          onValueChange={(value) => setFormData({ ...formData, accountableId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder={t("Select Accountable")} />
                          </SelectTrigger>
                          <SelectContent>
                            {raciUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>{t("Consulted")}</Label>
                        <Select
                          value={formData.consultedId}
                          onValueChange={(value) => setFormData({ ...formData, consultedId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder={t("Select Consulted")} />
                          </SelectTrigger>
                          <SelectContent>
                            {raciUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t("Informed")}</Label>
                        <Select
                          value={formData.informedId}
                          onValueChange={(value) => setFormData({ ...formData, informedId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder={t("Select Informed")} />
                          </SelectTrigger>
                          <SelectContent>
                            {raciUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-6 sm:mt-8 max-w-4xl mx-auto">
            <span className="text-xs font-medium text-slate-400 me-auto">
              {t("Step")} {currentStep} {t("of")} {TOTAL_STEPS}
            </span>
            <Button
              variant="outline"
              onClick={() => {
                if (currentStep === 1) {
                  router.push("/internal-audit/settings/process");
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
        </div>
      </div>

      {/* Add Process Frequency Dialog */}
      <Dialog open={showFrequencyDialog} onOpenChange={setShowFrequencyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Process Frequency")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="frequencyName">{t("Name")} *</Label>
              <Input
                id="frequencyName"
                value={newFrequency}
                onChange={(e) => {
                  setNewFrequency(e.target.value);
                  setFrequencyError("");
                }}
                placeholder={t("e.g., Daily, Weekly, Monthly, Quarterly")}
                className={`mt-2 ${frequencyError ? "border-red-500" : ""}`}
              />
              {frequencyError && <p className="text-sm text-red-500 mt-1">{frequencyError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFrequencyDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddFrequency} disabled={dialogSaving}>
              {dialogSaving ? t("Adding...") : t("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Nature of Implementation Dialog */}
      <Dialog open={showNatureDialog} onOpenChange={setShowNatureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Nature of Implementation")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nature">{t("Name")} *</Label>
              <Input
                id="nature"
                value={newNature}
                onChange={(e) => {
                  setNewNature(e.target.value);
                  setNatureError("");
                }}
                placeholder={t("e.g., Manual, Automated, Manual + Automated")}
                className={`mt-2 ${natureError ? "border-red-500" : ""}`}
              />
              {natureError && <p className="text-sm text-red-500 mt-1">{natureError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNatureDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddNature} disabled={dialogSaving}>
              {dialogSaving ? t("Adding...") : t("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Add Location")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="locationName">{t("Location Name")} *</Label>
              <Input
                id="locationName"
                value={newLocation}
                onChange={(e) => {
                  setNewLocation(e.target.value);
                  setLocationError("");
                }}
                placeholder={t("e.g., Head Office, Branch A, Remote")}
                className={`mt-2 ${locationError ? "border-red-500" : ""}`}
              />
              {locationError && <p className="text-sm text-red-500 mt-1">{locationError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              {t("Cancel")}
            </Button>
            <Button onClick={handleAddLocation} disabled={dialogSaving}>
              {dialogSaving ? t("Adding...") : t("Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
