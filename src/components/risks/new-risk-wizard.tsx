"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, Plus, Search, Trash2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { triggerTranslation, useTranslatedData } from "@/hooks/useTranslatedData";

interface Category {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

interface RiskType {
  id: string;
  name: string;
}

interface Threat {
  id: string;
  name: string;
}

interface Vulnerability {
  id: string;
  name: string;
}

interface Cause {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  assetId: string;
  name: string;
}

interface Process {
  id: string;
  processCode: string;
  name: string;
}

interface Control {
  id: string;
  controlCode: string;
  name: string;
  description: string | null;
  domain: { id: string; name: string } | null;
}

interface EditRiskData {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskSources: string | null;
  category: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; fullName: string } | null;
  threats?: { threat: { id: string; name: string } }[];
  vulnerabilities?: { vulnerability: { id: string; name: string } }[];
  causes?: { cause: { id: string; name: string } }[];
  impactedAsset?: { id: string; assetId: string; name: string } | null;
  impactedProcess?: { id: string; processCode: string; name: string } | null;
  controlRisks?: { control: { id: string; controlCode: string; name: string; status: string } }[];
}

interface NewRiskWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categories: Category[];
  departments: Department[];
  editData?: EditRiskData | null;
}

const steps = [
  { id: 1, name: "Risk Details", description: "Basic risk information" },
  { id: 2, name: "Risk Mapping", description: "Link controls to risk" },
];

export function NewRiskWizard({
  open,
  onOpenChange,
  onSuccess,
  categories,
  departments,
  editData,
}: NewRiskWizardProps) {
  const { t } = useLanguage();
  const isEditMode = !!editData;
  const [currentStep, setCurrentStep] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedRiskId, setGeneratedRiskId] = useState("");
  const [linkControlDialogOpen, setLinkControlDialogOpen] = useState(false);
  const [controlSearch, setControlSearch] = useState("");
  const [createCauseDialogOpen, setCreateCauseDialogOpen] = useState(false);
  const [newCauseName, setNewCauseName] = useState("");
  const [newCauseDescription, setNewCauseDescription] = useState("");
  const [creatingCause, setCreatingCause] = useState(false);

  // Create Category dialog state
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);

  // Create Threat dialog state
  const [createThreatDialogOpen, setCreateThreatDialogOpen] = useState(false);
  const [newThreatName, setNewThreatName] = useState("");
  const [newThreatDescription, setNewThreatDescription] = useState("");
  const [creatingThreat, setCreatingThreat] = useState(false);

  // Create Vulnerability dialog state
  const [createVulnerabilityDialogOpen, setCreateVulnerabilityDialogOpen] = useState(false);
  const [newVulnerabilityName, setNewVulnerabilityName] = useState("");
  const [newVulnerabilityDescription, setNewVulnerabilityDescription] = useState("");
  const [creatingVulnerability, setCreatingVulnerability] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Translate dropdown/tag data for non-English locales
  const { data: translatedThreats } = useTranslatedData(threats, { modelName: 'RiskThreat' });
  const { data: translatedVulnerabilities } = useTranslatedData(vulnerabilities, { modelName: 'RiskVulnerability' });
  const { data: translatedCauses } = useTranslatedData(causes, { modelName: 'RiskCause' });
  const { data: translatedCategories } = useTranslatedData(localCategories, { modelName: 'RiskCategory' });
  const { data: translatedRiskTypes } = useTranslatedData(riskTypes, { modelName: 'RiskType' });

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    riskSources: "",
    categoryId: "",
    typeId: "",
    departmentId: "",
    ownerId: "",
    impactedAssetId: "",
    impactedProcessId: "",
    selectedThreats: [] as string[],
    selectedVulnerabilities: [] as string[],
    selectedCauses: [] as string[],
    selectedControls: [] as string[],
  });

  useEffect(() => {
    if (open) {
      fetchRiskTypes();
      fetchThreats();
      fetchVulnerabilities();
      fetchCauses();
      fetchAssets();
      fetchProcesses();
      fetchControls();
      setLocalCategories(categories);

      if (isEditMode && editData) {
        // Pre-fill form with edit data
        setGeneratedRiskId(editData.riskId);
        setFormData({
          name: editData.name || "",
          description: editData.description || "",
          riskSources: editData.riskSources || "",
          categoryId: editData.category?.id || "",
          typeId: editData.type?.id || "",
          departmentId: editData.department?.id || "",
          ownerId: editData.owner?.id || "",
          impactedAssetId: editData.impactedAsset?.id || "",
          impactedProcessId: editData.impactedProcess?.id || "",
          selectedThreats: editData.threats?.map(t => t.threat.id) || [],
          selectedVulnerabilities: editData.vulnerabilities?.map(v => v.vulnerability.id) || [],
          selectedCauses: editData.causes?.map(c => c.cause.id) || [],
          selectedControls: editData.controlRisks?.map(cr => cr.control.id) || [],
        });
        // Fetch DepartmentReviewers for the existing department (if editing)
        if (editData.department?.id) {
          fetchUsers(editData.department.id);
        } else {
          setUsers([]);
        }
      } else {
        generateRiskId();
        setUsers([]); // Clear users until department is selected
      }
    }
  }, [open, editData, isEditMode]);

  const generateRiskId = async () => {
    try {
      const response = await fetch("/api/risks?limit=1");
      if (response.ok) {
        const data = await response.json();
        const lastRiskId = data.data?.[0]?.riskId || "RID000";
        const match = lastRiskId.match(/RID(\d+)/);
        if (match) {
          const nextNum = parseInt(match[1], 10) + 1;
          setGeneratedRiskId(`RID${String(nextNum).padStart(3, "0")}`);
        } else {
          setGeneratedRiskId("RID001");
        }
      }
    } catch (error) {
      setGeneratedRiskId("RID001");
    }
  };

  const fetchUsers = async (departmentId?: string) => {
    try {
      // If departmentId is provided, fetch only DepartmentReviewers for that department
      let url = "/api/users";
      if (departmentId) {
        url = `/api/users?role=DepartmentReviewer&departmentId=${departmentId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const fetchRiskTypes = async () => {
    try {
      const response = await fetch("/api/risk-types");
      if (response.ok) {
        const data = await response.json();
        setRiskTypes(data);
      }
    } catch (error) {
      console.error("Failed to fetch risk types:", error);
    }
  };

  const fetchThreats = async () => {
    try {
      const response = await fetch("/api/risk-threats");
      if (response.ok) {
        const data = await response.json();
        setThreats(data);
      }
    } catch (error) {
      console.error("Failed to fetch threats:", error);
    }
  };

  const fetchVulnerabilities = async () => {
    try {
      const response = await fetch("/api/risk-vulnerabilities");
      if (response.ok) {
        const data = await response.json();
        setVulnerabilities(data);
      }
    } catch (error) {
      console.error("Failed to fetch vulnerabilities:", error);
    }
  };

  const fetchCauses = async () => {
    try {
      const response = await fetch("/api/risk-causes");
      if (response.ok) {
        const data = await response.json();
        setCauses(data);
      }
    } catch (error) {
      console.error("Failed to fetch causes:", error);
    }
  };

  const fetchAssets = async () => {
    try {
      const response = await fetch("/api/assets");
      if (response.ok) {
        const data = await response.json();
        setAssets(data.data || data);
      }
    } catch (error) {
      console.error("Failed to fetch assets:", error);
    }
  };

  const fetchProcesses = async () => {
    try {
      const response = await fetch("/api/processes");
      if (response.ok) {
        const data = await response.json();
        setProcesses(data.data || data);
      }
    } catch (error) {
      console.error("Failed to fetch processes:", error);
    }
  };

  const fetchControls = async () => {
    try {
      const response = await fetch("/api/controls");
      if (response.ok) {
        const data = await response.json();
        setControls(data.data || data);
      }
    } catch (error) {
      console.error("Failed to fetch controls:", error);
    }
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // When department changes, fetch DepartmentReviewers for that department and clear owner
    if (field === "departmentId" && typeof value === "string") {
      setFormData((prev) => ({ ...prev, ownerId: "" })); // Clear owner selection
      if (value) {
        fetchUsers(value); // Fetch DepartmentReviewers for selected department
      } else {
        setUsers([]); // Clear users if no department selected
      }
    }

    // When risk type changes, clear the opposite impacted field
    if (field === "typeId" && typeof value === "string") {
      const selectedType = riskTypes.find(t => t.id === value);
      if (selectedType?.name === "Asset Risk") {
        setFormData((prev) => ({ ...prev, impactedProcessId: "" }));
      } else if (selectedType?.name === "Process Risk") {
        setFormData((prev) => ({ ...prev, impactedAssetId: "" }));
      }
    }
  };

  const addToSelection = (field: string, value: string) => {
    const currentSelection = formData[field as keyof typeof formData] as string[];
    if (!currentSelection.includes(value)) {
      handleInputChange(field, [...currentSelection, value]);
    }
  };

  const removeFromSelection = (field: string, value: string) => {
    const currentSelection = formData[field as keyof typeof formData] as string[];
    handleInputChange(
      field,
      currentSelection.filter((v) => v !== value)
    );
  };

  const validateStep = (): boolean => {
    const errors: { [key: string]: string } = {};

    switch (currentStep) {
      case 1:
        // Validate required fields
        if (!formData.name.trim()) {
          errors.name = t("Please enter the Risk Name");
        }
        if (!formData.departmentId) {
          errors.departmentId = t("Please select the Department");
        }
        if (!formData.ownerId) {
          errors.ownerId = t("Please select the Risk Owner");
        }
        if (!formData.riskSources.trim()) {
          errors.riskSources = t("Please enter the Risk Sources");
        }
        if (!formData.categoryId) {
          errors.categoryId = t("Please select the Risk Category");
        }
        if (!formData.typeId) {
          errors.typeId = t("Please select the Risk Type");
        }
        if (formData.selectedThreats.length === 0) {
          errors.selectedThreats = t("Please select the Threat");
        }
        if (formData.selectedVulnerabilities.length === 0) {
          errors.selectedVulnerabilities = t("Please select the Vulnerability");
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
      case 2:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      }
    }
    // Validation errors are displayed inline next to fields
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const url = isEditMode ? `/api/risks/${editData!.id}` : "/api/risks";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          riskSources: formData.riskSources || null,
          categoryId: formData.categoryId || null,
          typeId: formData.typeId || null,
          departmentId: formData.departmentId || null,
          ownerId: formData.ownerId || null,
          impactedAssetId: formData.impactedAssetId || null,
          impactedProcessId: formData.impactedProcessId || null,
          threats: formData.selectedThreats,
          vulnerabilities: formData.selectedVulnerabilities,
          causes: formData.selectedCauses,
          controls: formData.selectedControls,
          actor: "System",
        }),
      });

      if (response.ok) {
        const responseData = await response.json().catch(() => null);
        const riskId = isEditMode ? editData!.id : responseData?.id;

        // Trigger dynamic data translation (fire-and-forget)
        if (riskId) {
          triggerTranslation('Risk', riskId, {
            name: formData.name,
            description: formData.description || null,
            riskSources: formData.riskSources || null,
          });
        }

        toast.success(isEditMode ? t("Risk updated successfully") : t("Risk created successfully"));
        resetForm();
        onSuccess();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || (isEditMode ? t("Failed to update risk") : t("Failed to create risk")));
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} risk:`, error);
      toast.error(isEditMode ? t("Failed to update risk") : t("Failed to create risk"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      name: "",
      description: "",
      riskSources: "",
      categoryId: "",
      typeId: "",
      departmentId: "",
      ownerId: "",
      impactedAssetId: "",
      impactedProcessId: "",
      selectedThreats: [],
      selectedVulnerabilities: [],
      selectedCauses: [],
      selectedControls: [],
    });
    setControlSearch("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const getSelectedThreatNames = () => {
    return formData.selectedThreats
      .map((id) => translatedThreats.find((t) => t.id === id)?.name)
      .filter(Boolean);
  };

  const getSelectedVulnerabilityNames = () => {
    return formData.selectedVulnerabilities
      .map((id) => translatedVulnerabilities.find((v) => v.id === id)?.name)
      .filter(Boolean);
  };

  const getSelectedCauseNames = () => {
    return formData.selectedCauses
      .map((id) => translatedCauses.find((c) => c.id === id)?.name)
      .filter(Boolean);
  };

  const handleCreateCause = async () => {
    if (!newCauseName.trim()) {
      toast.error(t("Cause name is required"));
      return;
    }
    setCreatingCause(true);
    try {
      const res = await fetch("/api/risk-causes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCauseName.trim(),
          description: newCauseDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t("Failed to create cause"));
      }
      const newCause = await res.json();
      setCauses((prev) => [...prev, newCause]);
      setFormData((prev) => ({
        ...prev,
        selectedCauses: [...prev.selectedCauses, newCause.id],
      }));
      triggerTranslation('RiskCause', newCause.id, { name: newCauseName.trim() });
      setNewCauseName("");
      setNewCauseDescription("");
      setCreateCauseDialogOpen(false);
      toast.success(t("Cause created successfully"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to create cause"));
    } finally {
      setCreatingCause(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error(t("Category name is required"));
      return;
    }
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/risk-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t("Failed to create category"));
      }
      const newCategory = await res.json();
      setLocalCategories((prev) => [...prev, newCategory]);
      setFormData((prev) => ({
        ...prev,
        categoryId: newCategory.id,
      }));
      triggerTranslation('RiskCategory', newCategory.id, { name: newCategoryName.trim(), description: newCategoryDescription.trim() || null });
      setNewCategoryName("");
      setNewCategoryDescription("");
      setCreateCategoryDialogOpen(false);
      toast.success(t("Category created successfully"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to create category"));
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateThreat = async () => {
    if (!newThreatName.trim()) {
      toast.error(t("Threat name is required"));
      return;
    }
    setCreatingThreat(true);
    try {
      const res = await fetch("/api/risk-threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newThreatName.trim(),
          description: newThreatDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t("Failed to create threat"));
      }
      const newThreat = await res.json();
      setThreats((prev) => [...prev, newThreat]);
      setFormData((prev) => ({
        ...prev,
        selectedThreats: [...prev.selectedThreats, newThreat.id],
      }));
      triggerTranslation('RiskThreat', newThreat.id, { name: newThreatName.trim(), description: newThreatDescription.trim() || null });
      setNewThreatName("");
      setNewThreatDescription("");
      setCreateThreatDialogOpen(false);
      toast.success(t("Threat created successfully"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to create threat"));
    } finally {
      setCreatingThreat(false);
    }
  };

  const handleCreateVulnerability = async () => {
    if (!newVulnerabilityName.trim()) {
      toast.error(t("Vulnerability name is required"));
      return;
    }
    setCreatingVulnerability(true);
    try {
      const res = await fetch("/api/risk-vulnerabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newVulnerabilityName.trim(),
          description: newVulnerabilityDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || t("Failed to create vulnerability"));
      }
      const newVulnerability = await res.json();
      setVulnerabilities((prev) => [...prev, newVulnerability]);
      setFormData((prev) => ({
        ...prev,
        selectedVulnerabilities: [...prev.selectedVulnerabilities, newVulnerability.id],
      }));
      triggerTranslation('RiskVulnerability', newVulnerability.id, { name: newVulnerabilityName.trim(), description: newVulnerabilityDescription.trim() || null });
      setNewVulnerabilityName("");
      setNewVulnerabilityDescription("");
      setCreateVulnerabilityDialogOpen(false);
      toast.success(t("Vulnerability created successfully"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to create vulnerability"));
    } finally {
      setCreatingVulnerability(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex-shrink-0 px-4 sm:px-6 pt-6 pb-4 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-800">{isEditMode ? `${t("Edit Risk")} - ${editData?.riskId}` : t("New Risk")}</DialogTitle>
          </DialogHeader>

          {/* Step Indicator */}
          <div className="flex items-start justify-center pt-5">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start">
                <div className="flex flex-col items-center w-32">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      currentStep > step.id
                        ? "bg-success text-white"
                        : currentStep === step.id
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 text-slate-400 border border-slate-200"
                    )}
                  >
                    {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs font-medium text-center",
                      currentStep >= step.id ? "text-slate-700" : "text-slate-400"
                    )}
                  >
                    {t(step.name)}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mt-[18px] -mx-5 transition-colors",
                      currentStep > step.id ? "bg-success" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">

          {/* Step Content */}
          <div className="min-h-[400px]">
            {/* Step 1: Risk Details */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="riskId">{t("Risk ID")}</Label>
                    <Input
                      id="riskId"
                      value={generatedRiskId}
                      disabled
                      className="bg-slate-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t("Risk Name")} *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder={t("Enter Risk Name")}
                      className={validationErrors.name ? "border-red-500" : ""}
                    />
                    {validationErrors.name && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">{t("Risk Description")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder={t("Enter Description")}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="department">{t("Department")} *</Label>
                    <Select
                      value={formData.departmentId}
                      onValueChange={(value) => handleInputChange("departmentId", value)}
                    >
                      <SelectTrigger className={cn("w-full", validationErrors.departmentId && "border-red-500")}>
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
                    {validationErrors.departmentId && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.departmentId}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner">{t("Risk Owner")} *</Label>
                    <Select
                      value={formData.ownerId}
                      onValueChange={(value) => handleInputChange("ownerId", value)}
                      disabled={!formData.departmentId}
                    >
                      <SelectTrigger className={cn("w-full", validationErrors.ownerId && "border-red-500")}>
                        <SelectValue placeholder={formData.departmentId ? t("Select Owner") : t("Select Department first")} />
                      </SelectTrigger>
                      <SelectContent>
                        {users.length === 0 ? (
                          <div className="py-2 px-3 text-sm text-muted-foreground">
                            {t("No Department Reviewers found")}
                          </div>
                        ) : (
                          users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {validationErrors.ownerId && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.ownerId}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="riskSources">{t("Risk Sources")} *</Label>
                    <Input
                      id="riskSources"
                      value={formData.riskSources}
                      onChange={(e) => handleInputChange("riskSources", e.target.value)}
                      placeholder={t("Enter risk sources")}
                      className={validationErrors.riskSources ? "border-red-500" : ""}
                    />
                    {validationErrors.riskSources && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.riskSources}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="category">{t("Risk Category")} *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => handleInputChange("categoryId", value)}
                      >
                        <SelectTrigger className={cn("flex-1", validationErrors.categoryId && "border-red-500")}>
                          <SelectValue placeholder={t("Select Category")} />
                        </SelectTrigger>
                        <SelectContent>
                          {translatedCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCreateCategoryDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {validationErrors.categoryId && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.categoryId}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="riskType">{t("Risk Type")} *</Label>
                    <Select
                      value={formData.typeId}
                      onValueChange={(value) => handleInputChange("typeId", value)}
                    >
                      <SelectTrigger className={cn("w-full", validationErrors.typeId && "border-red-500")}>
                        <SelectValue placeholder={t("Select Risk Type")} />
                      </SelectTrigger>
                      <SelectContent>
                        {translatedRiskTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {t(type.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.typeId && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.typeId}</p>
                    )}
                  </div>
                  {riskTypes.find(t => t.id === formData.typeId)?.name === "Asset Risk" && (
                    <div className="space-y-1.5">
                      <Label>{t("Impacted Asset")}</Label>
                      <Select
                        value={formData.impactedAssetId}
                        onValueChange={(value) => handleInputChange("impactedAssetId", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("Select impacted asset")} />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.assetId} - {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {riskTypes.find(t => t.id === formData.typeId)?.name === "Process Risk" && (
                    <div className="space-y-1.5">
                      <Label>{t("Impacted Process")}</Label>
                      <Select
                        value={formData.impactedProcessId}
                        onValueChange={(value) => handleInputChange("impactedProcessId", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("Select impacted process")} />
                        </SelectTrigger>
                        <SelectContent>
                          {processes.map((process) => (
                            <SelectItem key={process.id} value={process.id}>
                              {process.processCode} - {process.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {!formData.typeId && (
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">{t("Impacted Asset/Process")}</Label>
                      <Select disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("Select Risk Type first")} />
                        </SelectTrigger>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("Potential Threats")} *</Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => addToSelection("selectedThreats", value)}
                      >
                        <SelectTrigger className={cn("flex-1", validationErrors.selectedThreats && "border-red-500")}>
                          <SelectValue placeholder={t("Select threats")} />
                        </SelectTrigger>
                        <SelectContent>
                          {translatedThreats.map((threat) => (
                            <SelectItem key={threat.id} value={threat.id}>
                              {threat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCreateThreatDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getSelectedThreatNames().map((name, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {name}
                          <button
                            onClick={() =>
                              removeFromSelection(
                                "selectedThreats",
                                formData.selectedThreats[index]
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    {validationErrors.selectedThreats && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.selectedThreats}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("Associated Vulnerabilities")} *</Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) =>
                          addToSelection("selectedVulnerabilities", value)
                        }
                      >
                        <SelectTrigger className={cn("flex-1", validationErrors.selectedVulnerabilities && "border-red-500")}>
                          <SelectValue placeholder={t("Select vulnerabilities")} />
                        </SelectTrigger>
                        <SelectContent>
                          {translatedVulnerabilities.map((vuln) => (
                            <SelectItem key={vuln.id} value={vuln.id}>
                              {vuln.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCreateVulnerabilityDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getSelectedVulnerabilityNames().map((name, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {name}
                          <button
                            onClick={() =>
                              removeFromSelection(
                                "selectedVulnerabilities",
                                formData.selectedVulnerabilities[index]
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    {validationErrors.selectedVulnerabilities && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.selectedVulnerabilities}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("Cause")}</Label>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(value) => addToSelection("selectedCauses", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("Select cause")} />
                      </SelectTrigger>
                      <SelectContent>
                        {translatedCauses.map((cause) => (
                          <SelectItem key={cause.id} value={cause.id}>
                            {cause.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setCreateCauseDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {getSelectedCauseNames().map((name, index) => (
                      <Badge key={index} variant="secondary" className="gap-1">
                        {name}
                        <button
                          onClick={() =>
                            removeFromSelection(
                              "selectedCauses",
                              formData.selectedCauses[index]
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Risk Mapping (Controls) */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-semibold text-slate-800">{t("Controls")}</h3>
                  <Button variant="outline" onClick={() => setLinkControlDialogOpen(true)}>
                    <Plus className="h-4 w-4 me-2" />
                    {t("Link Control")}
                  </Button>
                </div>

                {formData.selectedControls.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr className="h-12">
                          <th className="text-start px-4 text-sm font-medium text-slate-700">{t("Control Code")}</th>
                          <th className="text-start px-4 text-sm font-medium text-slate-700">{t("Name")}</th>
                          <th className="text-start px-4 text-sm font-medium text-slate-700">{t("Domain")}</th>
                          <th className="text-end px-4 text-sm font-medium text-slate-700">{t("Action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formData.selectedControls.map((controlId) => {
                          const control = controls.find(c => c.id === controlId);
                          if (!control) return null;
                          return (
                            <tr key={controlId} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-medium text-primary-600">{control.controlCode}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{control.name}</td>
                              <td className="px-4 py-3 text-sm text-slate-600">{control.domain?.name || "-"}</td>
                              <td className="px-4 py-3 text-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFromSelection("selectedControls", controlId)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg p-12 text-center text-slate-500">
                    <p>{t("No controls linked yet.")}</p>
                    <p className="text-sm mt-2">
                      {t("Click \"Link Control\" to associate controls with this risk.")}
                    </p>
                  </div>
                )}

                {/* Link Control Dialog */}
                <Dialog open={linkControlDialogOpen} onOpenChange={setLinkControlDialogOpen}>
                  <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
                      <DialogTitle className="text-lg font-semibold text-slate-800">{t("Link Controls")}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 py-4">
                      <div className="relative mb-4">
                        <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder={t("Search controls...")}
                          value={controlSearch}
                          onChange={(e) => setControlSearch(e.target.value)}
                          className="ps-9"
                        />
                      </div>
                      <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
                        <table className="w-full">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="h-12">
                              <th className="w-10 px-3"></th>
                              <th className="text-start px-3 text-sm font-medium text-slate-700">{t("Control Code")}</th>
                              <th className="text-start px-3 text-sm font-medium text-slate-700">{t("Name")}</th>
                              <th className="text-start px-3 text-sm font-medium text-slate-700">{t("Domain")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {controls
                              .filter(control =>
                                control.name.toLowerCase().includes(controlSearch.toLowerCase()) ||
                                control.controlCode.toLowerCase().includes(controlSearch.toLowerCase()) ||
                                (control.domain?.name || "").toLowerCase().includes(controlSearch.toLowerCase())
                              )
                              .map((control) => (
                                <tr key={control.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-3">
                                    <Checkbox
                                      checked={formData.selectedControls.includes(control.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          addToSelection("selectedControls", control.id);
                                        } else {
                                          removeFromSelection("selectedControls", control.id);
                                        }
                                      }}
                                    />
                                  </td>
                                  <td className="px-3 py-3 text-sm font-medium text-primary-600">{control.controlCode}</td>
                                  <td className="px-3 py-3 text-sm text-slate-600">{control.name}</td>
                                  <td className="px-3 py-3 text-sm text-slate-600">{control.domain?.name || "-"}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex justify-between items-center px-4 sm:px-6 py-4 border-t border-slate-100 bg-white rounded-b-lg">
                      <span className="text-sm text-slate-500">
                        {formData.selectedControls.length} {t("control(s) selected")}
                      </span>
                      <Button onClick={() => setLinkControlDialogOpen(false)}>
                        {t("Done")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
        </div>

        {/* Create Cause Dialog */}
        <Dialog open={createCauseDialogOpen} onOpenChange={setCreateCauseDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[400px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{t("Create New Cause")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newCauseName">{t("Name")} *</Label>
                <Input
                  id="newCauseName"
                  value={newCauseName}
                  onChange={(e) => setNewCauseName(e.target.value)}
                  placeholder={t("Enter cause name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCauseDescription">{t("Description")}</Label>
                <Textarea
                  id="newCauseDescription"
                  value={newCauseDescription}
                  onChange={(e) => setNewCauseDescription(e.target.value)}
                  placeholder={t("Enter cause description (optional)")}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateCauseDialogOpen(false);
                  setNewCauseName("");
                  setNewCauseDescription("");
                }}
              >
                {t("Cancel")}
              </Button>
              <Button onClick={handleCreateCause} disabled={creatingCause}>
                {creatingCause ? t("Creating...") : t("Create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Category Dialog */}
        <Dialog open={createCategoryDialogOpen} onOpenChange={setCreateCategoryDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[400px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{t("Create New Category")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newCategoryName">{t("Name")} *</Label>
                <Input
                  id="newCategoryName"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t("Enter category name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newCategoryDescription">{t("Description")}</Label>
                <Textarea
                  id="newCategoryDescription"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder={t("Enter category description (optional)")}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateCategoryDialogOpen(false);
                  setNewCategoryName("");
                  setNewCategoryDescription("");
                }}
              >
                {t("Cancel")}
              </Button>
              <Button onClick={handleCreateCategory} disabled={creatingCategory}>
                {creatingCategory ? t("Creating...") : t("Create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Threat Dialog */}
        <Dialog open={createThreatDialogOpen} onOpenChange={setCreateThreatDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[400px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{t("Create New Threat")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newThreatName">{t("Name")} *</Label>
                <Input
                  id="newThreatName"
                  value={newThreatName}
                  onChange={(e) => setNewThreatName(e.target.value)}
                  placeholder={t("Enter threat name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newThreatDescription">{t("Description")}</Label>
                <Textarea
                  id="newThreatDescription"
                  value={newThreatDescription}
                  onChange={(e) => setNewThreatDescription(e.target.value)}
                  placeholder={t("Enter threat description (optional)")}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateThreatDialogOpen(false);
                  setNewThreatName("");
                  setNewThreatDescription("");
                }}
              >
                {t("Cancel")}
              </Button>
              <Button onClick={handleCreateThreat} disabled={creatingThreat}>
                {creatingThreat ? t("Creating...") : t("Create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Vulnerability Dialog */}
        <Dialog open={createVulnerabilityDialogOpen} onOpenChange={setCreateVulnerabilityDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[400px]" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{t("Create New Vulnerability")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newVulnerabilityName">{t("Name")} *</Label>
                <Input
                  id="newVulnerabilityName"
                  value={newVulnerabilityName}
                  onChange={(e) => setNewVulnerabilityName(e.target.value)}
                  placeholder={t("Enter vulnerability name")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newVulnerabilityDescription">{t("Description")}</Label>
                <Textarea
                  id="newVulnerabilityDescription"
                  value={newVulnerabilityDescription}
                  onChange={(e) => setNewVulnerabilityDescription(e.target.value)}
                  placeholder={t("Enter vulnerability description (optional)")}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateVulnerabilityDialogOpen(false);
                  setNewVulnerabilityName("");
                  setNewVulnerabilityDescription("");
                }}
              >
                {t("Cancel")}
              </Button>
              <Button onClick={handleCreateVulnerability} disabled={creatingVulnerability}>
                {creatingVulnerability ? t("Creating...") : t("Create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Navigation Buttons */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
          <span className="text-xs font-medium text-slate-400 me-auto">
            {t("Step")} {currentStep} {t("of")} {steps.length}
          </span>
          <Button
            variant="outline"
            onClick={currentStep === 1 ? handleClose : handlePrevious}
          >
            {currentStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
            {currentStep === 1 ? t("Cancel") : t("Previous")}
          </Button>
          {currentStep < steps.length ? (
            <Button onClick={handleNext}>
              {t("Next")}
              <ChevronRight className="h-4 w-4 ms-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? t("Saving...") : (isEditMode ? t("Update Risk") : t("Save Risk"))}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
