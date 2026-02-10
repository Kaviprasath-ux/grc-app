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
import {
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Search,
  Trash2,
  FileText,
  Building2,
  User,
  Tag,
  AlertTriangle,
  Shield,
  Target,
  Zap,
  Info,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  { id: 1, name: "Risk Details", icon: FileText },
  { id: 2, name: "Risk Mapping", icon: Shield },
];

export function NewRiskWizard({
  open,
  onOpenChange,
  onSuccess,
  categories,
  departments,
  editData,
}: NewRiskWizardProps) {
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
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
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
    switch (currentStep) {
      case 1:
        return formData.name.trim() !== "";
      case 2:
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep() && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
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
        toast.success(isEditMode ? "Risk updated successfully" : "Risk created successfully");
        resetForm();
        onSuccess();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} risk`);
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} risk:`, error);
      toast.error(`Failed to ${isEditMode ? 'update' : 'create'} risk`);
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
    setSelectedDomain("all");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const getSelectedThreatNames = () => {
    return formData.selectedThreats
      .map((id) => threats.find((t) => t.id === id)?.name)
      .filter(Boolean);
  };

  const getSelectedVulnerabilityNames = () => {
    return formData.selectedVulnerabilities
      .map((id) => vulnerabilities.find((v) => v.id === id)?.name)
      .filter(Boolean);
  };

  const getSelectedCauseNames = () => {
    return formData.selectedCauses
      .map((id) => causes.find((c) => c.id === id)?.name)
      .filter(Boolean);
  };

  const handleCreateCause = async () => {
    if (!newCauseName.trim()) {
      toast.error("Cause name is required");
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
        throw new Error(errorData.error || "Failed to create cause");
      }
      const newCause = await res.json();
      setCauses((prev) => [...prev, newCause]);
      setFormData((prev) => ({
        ...prev,
        selectedCauses: [...prev.selectedCauses, newCause.id],
      }));
      setNewCauseName("");
      setNewCauseDescription("");
      setCreateCauseDialogOpen(false);
      toast.success("Cause created successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create cause");
    } finally {
      setCreatingCause(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Category name is required");
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
        throw new Error(errorData.error || "Failed to create category");
      }
      const newCategory = await res.json();
      setLocalCategories((prev) => [...prev, newCategory]);
      setFormData((prev) => ({
        ...prev,
        categoryId: newCategory.id,
      }));
      setNewCategoryName("");
      setNewCategoryDescription("");
      setCreateCategoryDialogOpen(false);
      toast.success("Category created successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateThreat = async () => {
    if (!newThreatName.trim()) {
      toast.error("Threat name is required");
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
        throw new Error(errorData.error || "Failed to create threat");
      }
      const newThreat = await res.json();
      setThreats((prev) => [...prev, newThreat]);
      setFormData((prev) => ({
        ...prev,
        selectedThreats: [...prev.selectedThreats, newThreat.id],
      }));
      setNewThreatName("");
      setNewThreatDescription("");
      setCreateThreatDialogOpen(false);
      toast.success("Threat created successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create threat");
    } finally {
      setCreatingThreat(false);
    }
  };

  const handleCreateVulnerability = async () => {
    if (!newVulnerabilityName.trim()) {
      toast.error("Vulnerability name is required");
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
        throw new Error(errorData.error || "Failed to create vulnerability");
      }
      const newVulnerability = await res.json();
      setVulnerabilities((prev) => [...prev, newVulnerability]);
      setFormData((prev) => ({
        ...prev,
        selectedVulnerabilities: [...prev.selectedVulnerabilities, newVulnerability.id],
      }));
      setNewVulnerabilityName("");
      setNewVulnerabilityDescription("");
      setCreateVulnerabilityDialogOpen(false);
      toast.success("Vulnerability created successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create vulnerability");
    } finally {
      setCreatingVulnerability(false);
    }
  };

  // Get unique domains from controls
  const domains = Array.from(new Set(controls.map(c => c.domain?.name).filter(Boolean))) as string[];

  // Filter controls by search and domain
  const filteredControls = controls.filter(control => {
    const matchesSearch =
      control.name.toLowerCase().includes(controlSearch.toLowerCase()) ||
      control.controlCode.toLowerCase().includes(controlSearch.toLowerCase()) ||
      (control.domain?.name || "").toLowerCase().includes(controlSearch.toLowerCase());

    const matchesDomain = selectedDomain === "all" || control.domain?.name === selectedDomain;

    return matchesSearch && matchesDomain;
  });

  const CurrentStepIcon = steps[currentStep - 1].icon;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] h-[85vh] flex flex-col p-0 gap-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-800">
              {isEditMode ? `Edit Risk - ${editData?.riskId}` : "New Risk"}
            </DialogTitle>
          </DialogHeader>

          {/* Enhanced Step Indicator */}
          <div className="flex items-center justify-center pt-6 gap-3">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 transition-all",
                      isActive ? "scale-105" : "scale-100"
                    )}
                  >
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-sm",
                        isCompleted
                          ? "bg-success text-white ring-2 ring-success/20"
                          : isActive
                          ? "bg-primary-600 text-white ring-4 ring-primary-100"
                          : "bg-slate-100 text-slate-400 border-2 border-slate-200"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="text-center">
                      <p
                        className={cn(
                          "text-sm font-medium transition-colors",
                          isActive || isCompleted ? "text-slate-800" : "text-slate-400"
                        )}
                      >
                        {step.name}
                      </p>
                    </div>
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "w-16 h-0.5 mx-4 transition-colors",
                        currentStep > step.id ? "bg-success" : "bg-slate-200"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Step 1: Risk Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Section: Basic Information */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-primary-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">Basic Information</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Risk ID</Label>
                      <Input
                        value={generatedRiskId}
                        disabled
                        className="bg-white/50 border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                        Risk Name
                        <span className="text-error">*</span>
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder="Enter risk name"
                        className="bg-white border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Risk Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder="Provide a detailed description of the risk..."
                      rows={3}
                      className="bg-white border-slate-200 resize-none"
                    />
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Describe what the risk is and its potential impact
                    </p>
                  </div>
                </div>
              </div>

              {/* Section: Ownership & Classification */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">Ownership & Classification</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Department</Label>
                      <Select
                        value={formData.departmentId}
                        onValueChange={(value) => handleInputChange("departmentId", value)}
                      >
                        <SelectTrigger className="bg-white border-slate-200">
                          <SelectValue placeholder="Select department" />
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
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        Risk Owner
                      </Label>
                      <Select
                        value={formData.ownerId}
                        onValueChange={(value) => handleInputChange("ownerId", value)}
                        disabled={!formData.departmentId}
                      >
                        <SelectTrigger className="bg-white border-slate-200">
                          <SelectValue placeholder={formData.departmentId ? "Select owner" : "Select department first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {users.length === 0 ? (
                            <div className="py-2 px-3 text-sm text-slate-500">
                              No reviewers found
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
                      {!formData.departmentId && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          Select a department to choose an owner
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Risk Sources</Label>
                      <Input
                        value={formData.riskSources}
                        onChange={(e) => handleInputChange("riskSources", e.target.value)}
                        placeholder="e.g., Internal audit, External review"
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-slate-500" />
                        Risk Category
                      </Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.categoryId}
                          onValueChange={(value) => handleInputChange("categoryId", value)}
                        >
                          <SelectTrigger className="flex-1 bg-white border-slate-200">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {localCategories.map((cat) => (
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
                          className="flex-shrink-0 bg-white hover:bg-slate-50"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Risk Type</Label>
                      <Select
                        value={formData.typeId}
                        onValueChange={(value) => handleInputChange("typeId", value)}
                      >
                        <SelectTrigger className="bg-white border-slate-200">
                          <SelectValue placeholder="Select risk type" />
                        </SelectTrigger>
                        <SelectContent>
                          {riskTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Conditional dropdown based on Risk Type */}
                    {riskTypes.find(t => t.id === formData.typeId)?.name === "Asset Risk" && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                          <Target className="h-3.5 w-3.5 text-slate-500" />
                          Impacted Asset
                        </Label>
                        <Select
                          value={formData.impactedAssetId}
                          onValueChange={(value) => handleInputChange("impactedAssetId", value)}
                        >
                          <SelectTrigger className="bg-white border-slate-200">
                            <SelectValue placeholder="Select asset" />
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
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                          <Target className="h-3.5 w-3.5 text-slate-500" />
                          Impacted Process
                        </Label>
                        <Select
                          value={formData.impactedProcessId}
                          onValueChange={(value) => handleInputChange("impactedProcessId", value)}
                        >
                          <SelectTrigger className="bg-white border-slate-200">
                            <SelectValue placeholder="Select process" />
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
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-400">Impacted Asset/Process</Label>
                        <Select disabled>
                          <SelectTrigger className="bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Select risk type first" />
                          </SelectTrigger>
                        </Select>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          Choose a risk type to enable this field
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section: Risk Factors */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-5 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-primary-600" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">Risk Factors</h3>
                </div>

                <div className="space-y-5">
                  {/* Threats */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-slate-500" />
                      Potential Threats
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => addToSelection("selectedThreats", value)}
                      >
                        <SelectTrigger className="flex-1 bg-white border-slate-200">
                          <SelectValue placeholder="Select threats..." />
                        </SelectTrigger>
                        <SelectContent>
                          {threats.map((threat) => (
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
                        className="flex-shrink-0 bg-white hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.selectedThreats.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        {getSelectedThreatNames().map((name, index) => (
                          <Badge key={index} variant="secondary" className="gap-1.5 py-1.5 px-3 bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200">
                            <Zap className="h-3 w-3" />
                            {name}
                            <button
                              onClick={() =>
                                removeFromSelection(
                                  "selectedThreats",
                                  formData.selectedThreats[index]
                                )
                              }
                              className="hover:text-slate-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vulnerabilities */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-slate-500" />
                      Associated Vulnerabilities
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) =>
                          addToSelection("selectedVulnerabilities", value)
                        }
                      >
                        <SelectTrigger className="flex-1 bg-white border-slate-200">
                          <SelectValue placeholder="Select vulnerabilities..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vulnerabilities.map((vuln) => (
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
                        className="flex-shrink-0 bg-white hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.selectedVulnerabilities.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        {getSelectedVulnerabilityNames().map((name, index) => (
                          <Badge key={index} variant="secondary" className="gap-1.5 py-1.5 px-3 bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200">
                            <Shield className="h-3 w-3" />
                            {name}
                            <button
                              onClick={() =>
                                removeFromSelection(
                                  "selectedVulnerabilities",
                                  formData.selectedVulnerabilities[index]
                                )
                              }
                              className="hover:text-slate-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Causes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                      Root Causes
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => addToSelection("selectedCauses", value)}
                      >
                        <SelectTrigger className="flex-1 bg-white border-slate-200">
                          <SelectValue placeholder="Select causes..." />
                        </SelectTrigger>
                        <SelectContent>
                          {causes.map((cause) => (
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
                        className="flex-shrink-0 bg-white hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {formData.selectedCauses.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-slate-200">
                        {getSelectedCauseNames().map((name, index) => (
                          <Badge key={index} variant="secondary" className="gap-1.5 py-1.5 px-3 bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200">
                            <AlertTriangle className="h-3 w-3" />
                            {name}
                            <button
                              onClick={() =>
                                removeFromSelection(
                                  "selectedCauses",
                                  formData.selectedCauses[index]
                                )
                              }
                              className="hover:text-slate-900"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Risk Mapping (Controls) */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Linked Controls</h3>
                    <p className="text-sm text-slate-500">
                      {formData.selectedControls.length} control{formData.selectedControls.length !== 1 ? 's' : ''} linked
                    </p>
                  </div>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setLinkControlDialogOpen(true)}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Link Controls
                </Button>
              </div>

              {formData.selectedControls.length > 0 ? (
                <div className="grid gap-3">
                  {formData.selectedControls.map((controlId) => {
                    const control = controls.find(c => c.id === controlId);
                    if (!control) return null;
                    return (
                      <div
                        key={controlId}
                        className="group bg-gradient-to-br from-white to-slate-50 rounded-lg p-4 border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <Shield className="h-5 w-5 text-primary-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className="font-medium text-primary-600 text-sm">{control.controlCode}</h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromSelection("selectedControls", controlId)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-slate-400 hover:text-error hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <p className="text-sm text-slate-700 mb-2">{control.name}</p>
                            {control.domain && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                                <Tag className="h-3 w-3" />
                                {control.domain.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">No controls linked yet</p>
                  <p className="text-sm text-slate-500 mb-4">
                    Link controls to strengthen this risk's mitigation strategy
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setLinkControlDialogOpen(true)}
                    className="border-slate-300 hover:border-primary-300 hover:bg-primary-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Link Your First Control
                  </Button>
                </div>
              )}

              {/* Enhanced Link Control Dialog */}
              <Dialog open={linkControlDialogOpen} onOpenChange={setLinkControlDialogOpen}>
                <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0">
                  <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-100">
                    <DialogTitle className="text-lg font-semibold text-slate-800">Link Controls to Risk</DialogTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Select controls that help mitigate this risk
                    </p>
                  </DialogHeader>

                  <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
                    {/* Enhanced Search and Filter */}
                    <div className="flex gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search by code, name, or domain..."
                          value={controlSearch}
                          onChange={(e) => setControlSearch(e.target.value)}
                          className="pl-9 bg-slate-50 border-slate-200 focus:bg-white"
                        />
                      </div>
                      <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                        <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Domains</SelectItem>
                          {domains.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Results Count */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <p className="text-sm text-slate-600">
                        {filteredControls.length} control{filteredControls.length !== 1 ? 's' : ''} found
                      </p>
                      <p className="text-sm font-medium text-primary-600">
                        {formData.selectedControls.length} selected
                      </p>
                    </div>

                    {/* Controls List */}
                    <div className="flex-1 overflow-auto border border-slate-200 rounded-lg bg-slate-50">
                      {filteredControls.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {filteredControls.map((control) => {
                            const isSelected = formData.selectedControls.includes(control.id);
                            return (
                              <label
                                key={control.id}
                                className={cn(
                                  "flex items-start gap-4 p-4 cursor-pointer transition-colors hover:bg-white",
                                  isSelected && "bg-primary-50/50"
                                )}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      addToSelection("selectedControls", control.id);
                                    } else {
                                      removeFromSelection("selectedControls", control.id);
                                    }
                                  }}
                                  className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="font-medium text-primary-600 text-sm">
                                      {control.controlCode}
                                    </span>
                                    {control.domain && (
                                      <Badge variant="secondary" className="text-xs">
                                        {control.domain.name}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-700 leading-relaxed">
                                    {control.name}
                                  </p>
                                  {control.description && (
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                      {control.description}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-12">
                          <Search className="h-12 w-12 text-slate-300 mb-3" />
                          <p className="text-slate-500 font-medium">No controls found</p>
                          <p className="text-sm text-slate-400">Try adjusting your search or filter</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium text-primary-600">{formData.selectedControls.length}</span> control{formData.selectedControls.length !== 1 ? 's' : ''} selected
                    </p>
                    <Button onClick={() => setLinkControlDialogOpen(false)} className="bg-primary-600 hover:bg-primary-700">
                      <Check className="h-4 w-4 mr-2" />
                      Done
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Create Dialogs (Compact versions) */}
        {/* Create Cause Dialog */}
        <Dialog open={createCauseDialogOpen} onOpenChange={setCreateCauseDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-slate-600" />
                Create New Cause
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Name <span className="text-error">*</span>
                </Label>
                <Input
                  value={newCauseName}
                  onChange={(e) => setNewCauseName(e.target.value)}
                  placeholder="Enter cause name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <Textarea
                  value={newCauseDescription}
                  onChange={(e) => setNewCauseDescription(e.target.value)}
                  placeholder="Enter cause description (optional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateCauseDialogOpen(false);
                  setNewCauseName("");
                  setNewCauseDescription("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateCause} disabled={creatingCause}>
                {creatingCause ? "Creating..." : "Create Cause"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Category Dialog */}
        <Dialog open={createCategoryDialogOpen} onOpenChange={setCreateCategoryDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-slate-600" />
                Create New Category
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Name <span className="text-error">*</span>
                </Label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <Textarea
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Enter category description (optional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateCategoryDialogOpen(false);
                  setNewCategoryName("");
                  setNewCategoryDescription("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateCategory} disabled={creatingCategory}>
                {creatingCategory ? "Creating..." : "Create Category"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Threat Dialog */}
        <Dialog open={createThreatDialogOpen} onOpenChange={setCreateThreatDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-slate-600" />
                Create New Threat
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Name <span className="text-error">*</span>
                </Label>
                <Input
                  value={newThreatName}
                  onChange={(e) => setNewThreatName(e.target.value)}
                  placeholder="Enter threat name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <Textarea
                  value={newThreatDescription}
                  onChange={(e) => setNewThreatDescription(e.target.value)}
                  placeholder="Enter threat description (optional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateThreatDialogOpen(false);
                  setNewThreatName("");
                  setNewThreatDescription("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateThreat} disabled={creatingThreat}>
                {creatingThreat ? "Creating..." : "Create Threat"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Vulnerability Dialog */}
        <Dialog open={createVulnerabilityDialogOpen} onOpenChange={setCreateVulnerabilityDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-slate-600" />
                Create New Vulnerability
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">
                  Name <span className="text-error">*</span>
                </Label>
                <Input
                  value={newVulnerabilityName}
                  onChange={(e) => setNewVulnerabilityName(e.target.value)}
                  placeholder="Enter vulnerability name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Description</Label>
                <Textarea
                  value={newVulnerabilityDescription}
                  onChange={(e) => setNewVulnerabilityDescription(e.target.value)}
                  placeholder="Enter vulnerability description (optional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateVulnerabilityDialogOpen(false);
                  setNewVulnerabilityName("");
                  setNewVulnerabilityDescription("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateVulnerability} disabled={creatingVulnerability}>
                {creatingVulnerability ? "Creating..." : "Create Vulnerability"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80 rounded-b-lg">
          <div className="flex items-center gap-2 mr-auto">
            <CurrentStepIcon className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">
              Step {currentStep} of {steps.length}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={currentStep === 1 ? handleClose : handlePrevious}
          >
            {currentStep > 1 && <ChevronLeft className="h-4 w-4 mr-2" />}
            {currentStep === 1 ? "Cancel" : "Previous"}
          </Button>
          {currentStep < steps.length ? (
            <Button
              onClick={handleNext}
              disabled={!validateStep()}
              className="bg-primary-600 hover:bg-primary-700"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-success hover:bg-success/90"
            >
              {loading ? "Saving..." : (isEditMode ? "Update Risk" : "Save Risk")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
