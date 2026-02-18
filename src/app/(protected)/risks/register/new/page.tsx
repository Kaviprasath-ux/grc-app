"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { ChevronLeft, ChevronRight, X, Plus, Search, Trash2, Link2, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions, useUserRoles } from "@/hooks/usePermissions";
import { Unauthorized } from "@/components/ui/unauthorized";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";
import { isValidName } from "@/lib/validations";

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

const getSteps = (t: (key: string) => string) => [
  { id: 1, name: t("riskDetails"), description: t("basicRiskInformation") },
  { id: 2, name: t("riskMapping"), description: t("linkControlsToRisk") },
];

export default function NewRiskPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const userRoles = useUserRoles();
  const { canCreate, isLoading: permissionsLoading } = usePermissions('risk.register');
  const steps = getSteps(t);

  // Check if user is DepartmentContributor or DepartmentReviewer
  const isDepartmentRole = userRoles.some(
    (role) => role === "DepartmentReviewer" || role === "DepartmentContributor"
  );
  const userDepartmentId = session?.user?.departmentId;

  const [currentStep, setCurrentStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

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
    fetchCategories();
    fetchDepartments();
    fetchRiskTypes();
    fetchThreats();
    fetchVulnerabilities();
    fetchCauses();
    fetchAssets();
    fetchProcesses();
    fetchControls();
    generateRiskId();
  }, []);

  // Auto-set department for DepartmentContributor/DepartmentReviewer
  useEffect(() => {
    if (isDepartmentRole && userDepartmentId) {
      setFormData(prev => ({ ...prev, departmentId: userDepartmentId }));
      // Also fetch users for this department
      fetchUsers(userDepartmentId);
    }
  }, [isDepartmentRole, userDepartmentId]);

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

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/risk-categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

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

  const fetchUsers = async (departmentId?: string) => {
    try {
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

    if (field === "departmentId" && typeof value === "string") {
      setFormData((prev) => ({ ...prev, ownerId: "" }));
      if (value) {
        fetchUsers(value);
      } else {
        setUsers([]);
      }
    }

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
          errors.name = t("Please enter the Risk Name") || "Please enter the Risk Name";
        } else if (!isValidName(formData.name.trim())) {
          errors.name = t("Only letters, spaces, and hyphens are allowed");
        }
        if (!formData.departmentId) {
          errors.departmentId = t("Please select the Department") || "Please select the Department";
        }
        if (!formData.ownerId) {
          errors.ownerId = t("Please select the Risk Owner") || "Please select the Risk Owner";
        }
        if (!formData.riskSources.trim()) {
          errors.riskSources = t("Please enter the Risk Sources") || "Please enter the Risk Sources";
        }
        if (!formData.categoryId) {
          errors.categoryId = t("Please Select the Risk Category") || "Please Select the Risk Category";
        }
        if (!formData.typeId) {
          errors.typeId = t("Please Select the Risk Type") || "Please Select the Risk Type";
        }
        if (formData.selectedThreats.length === 0) {
          errors.selectedThreats = t("Please Select the Threat") || "Please Select the Threat";
        }
        if (formData.selectedVulnerabilities.length === 0) {
          errors.selectedVulnerabilities = t("Please Select the Vulnerability") || "Please Select the Vulnerability";
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
      const response = await fetch("/api/risks", {
        method: "POST",
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
        toast.success("Risk created successfully");
        router.push("/risks/register");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create risk");
      }
    } catch (error) {
      console.error("Failed to create risk:", error);
      toast.error("Failed to create risk");
    } finally {
      setLoading(false);
    }
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
      toast.error(t("causeNameRequired") || "Cause name is required");
      return;
    } else if (!isValidName(newCauseName.trim())) {
      toast.error(t("Only letters, spaces, and hyphens are allowed"));
      return;
    }

    setCreatingCause(true);
    try {
      const response = await fetch("/api/risk-causes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCauseName.trim(),
          description: newCauseDescription.trim() || null,
        }),
      });

      if (response.ok) {
        const newCause = await response.json();
        setCauses((prev) => [...prev, newCause]);
        addToSelection("selectedCauses", newCause.id);
        setCreateCauseDialogOpen(false);
        setNewCauseName("");
        setNewCauseDescription("");
        toast.success(t("causeCreatedSuccessfully") || "Cause created successfully");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create cause");
      }
    } catch (error) {
      console.error("Failed to create cause:", error);
      toast.error("Failed to create cause");
    } finally {
      setCreatingCause(false);
    }
  };

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!canCreate) {
    return <Unauthorized description={t("noPermissionToCreateRisks")} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto whitespace-nowrap">
        <Link href="/risks/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors">
          <Home className="h-4 w-4" />
          <span>{t("Risk Management")}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <Link href="/risks/register" className="text-slate-500 hover:text-primary-600 transition-colors">
          {t("Risk Register")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 ltr:rotate-0 rtl:rotate-180" />
        <span className="text-primary-700 font-medium">{t("New Risk")}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t("newRisk")}</h1>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-6 pt-4 sm:pt-6">
          {/* Stepper */}
          <div className="mb-6 sm:mb-8">
            <nav aria-label="Progress">
              <ol className="flex items-center">
                {steps.map((step, index) => (
                  <li
                    key={step.id}
                    className={cn(
                      "relative flex-1",
                      index !== steps.length - 1 && "sm:pr-8 pr-4"
                    )}
                  >
                    <div className="flex items-center">
                      <button
                        onClick={() => setCurrentStep(step.id)}
                        className={cn(
                          "flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full border-2 transition-colors flex-shrink-0",
                          currentStep >= step.id
                            ? "border-primary-500 bg-primary-500 text-white"
                            : "border-slate-300 bg-white text-slate-500"
                        )}
                      >
                        <span className="text-xs sm:text-sm font-medium">{step.id}</span>
                      </button>
                      <div className="ml-2 sm:ml-3 hidden sm:block">
                        <button
                          onClick={() => setCurrentStep(step.id)}
                          className={cn(
                            "text-sm font-medium",
                            currentStep >= step.id
                              ? "text-primary-600"
                              : "text-slate-500"
                          )}
                        >
                          {step.name}
                        </button>
                        <p className="text-xs text-slate-500">{step.description}</p>
                      </div>
                      {index !== steps.length - 1 && (
                        <div
                          className={cn(
                            "ml-2 sm:ml-6 h-0.5 flex-1",
                            currentStep > step.id ? "bg-primary-500" : "bg-slate-300"
                          )}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          {/* Step Content */}
          <div className="min-h-[500px]">
            {/* Step 1: Risk Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">{t("riskDetails")}</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="riskId">{t("riskId")}</Label>
                    <Input
                      id="riskId"
                      value={generatedRiskId}
                      disabled
                      className="bg-slate-100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">{t("riskName")} *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder={t("enterRiskName")}
                      className={validationErrors.name ? "border-red-500" : ""}
                    />
                    {validationErrors.name && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">{t("riskDescription")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder={t("enterDescription")}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="department">{t("department")} *</Label>
                    <Select
                      value={formData.departmentId}
                      onValueChange={(value) => handleInputChange("departmentId", value)}
                      disabled={isDepartmentRole}
                    >
                      <SelectTrigger className={validationErrors.departmentId ? "border-red-500" : ""}>
                        <SelectValue placeholder={t("selectDepartment")} />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
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
                  <div>
                    <Label htmlFor="owner">{t("riskOwner")} *</Label>
                    <Select
                      value={formData.ownerId}
                      onValueChange={(value) => handleInputChange("ownerId", value)}
                      disabled={!formData.departmentId}
                    >
                      <SelectTrigger className={validationErrors.ownerId ? "border-red-500" : ""}>
                        <SelectValue placeholder={formData.departmentId ? t("selectOwner") : t("selectDepartmentFirst")} />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {users.length === 0 ? (
                          <div className="py-2 px-3 text-sm text-muted-foreground">
                            {t("noDepartmentReviewersFound")}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="riskSources">{t("riskSources")} *</Label>
                    <Input
                      id="riskSources"
                      value={formData.riskSources}
                      onChange={(e) => handleInputChange("riskSources", e.target.value)}
                      placeholder={t("enterRiskSources")}
                      className={validationErrors.riskSources ? "border-red-500" : ""}
                    />
                    {validationErrors.riskSources && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.riskSources}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="category">{t("riskCategory")} *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => handleInputChange("categoryId", value)}
                      >
                        <SelectTrigger className={cn("flex-1", validationErrors.categoryId && "border-red-500")}>
                          <SelectValue placeholder={t("selectCategory")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {validationErrors.categoryId && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.categoryId}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label htmlFor="riskType">{t("riskType")} *</Label>
                    <Select
                      value={formData.typeId}
                      onValueChange={(value) => handleInputChange("typeId", value)}
                    >
                      <SelectTrigger className={validationErrors.typeId ? "border-red-500" : ""}>
                        <SelectValue placeholder={t("riskType")} />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {riskTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.typeId && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.typeId}</p>
                    )}
                  </div>
                  {riskTypes.find(rt => rt.id === formData.typeId)?.name === "Asset Risk" && (
                    <div>
                      <Label>{t("impactedAsset")}</Label>
                      <Select
                        value={formData.impactedAssetId}
                        onValueChange={(value) => handleInputChange("impactedAssetId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectImpactedAsset")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.assetId} - {asset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {riskTypes.find(rt => rt.id === formData.typeId)?.name === "Process Risk" && (
                    <div>
                      <Label>{t("impactedProcess")}</Label>
                      <Select
                        value={formData.impactedProcessId}
                        onValueChange={(value) => handleInputChange("impactedProcessId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectImpactedProcess")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
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
                    <div>
                      <Label className="text-muted-foreground">{t("impactedAssetProcess")}</Label>
                      <Select disabled>
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectRiskTypeFirst")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          <SelectItem value="none">{t("selectRiskTypeFirst")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label>{t("potentialThreats")} *</Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => addToSelection("selectedThreats", value)}
                      >
                        <SelectTrigger className={cn("flex-1", validationErrors.selectedThreats && "border-red-500")}>
                          <SelectValue placeholder={t("selectThreats")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {threats.map((threat) => (
                            <SelectItem key={threat.id} value={threat.id}>
                              {threat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon">
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
                  <div>
                    <Label>{t("associatedVulnerabilities")} *</Label>
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) =>
                          addToSelection("selectedVulnerabilities", value)
                        }
                      >
                        <SelectTrigger className={cn("flex-1", validationErrors.selectedVulnerabilities && "border-red-500")}>
                          <SelectValue placeholder={t("selectVulnerabilities")} />
                        </SelectTrigger>
                        <SelectContent className="z-[9999]">
                          {vulnerabilities.map((vuln) => (
                            <SelectItem key={vuln.id} value={vuln.id}>
                              {vuln.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon">
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

                <div>
                  <Label>{t("cause")}</Label>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(value) => addToSelection("selectedCauses", value)}
                    >
                      <SelectTrigger className="flex-1 sm:max-w-md">
                        <SelectValue placeholder={t("selectCause")} />
                      </SelectTrigger>
                      <SelectContent className="z-[9999]">
                        {causes.map((cause) => (
                          <SelectItem key={cause.id} value={cause.id}>
                            {cause.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setCreateCauseDialogOpen(true)}>
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
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-semibold text-slate-800">{t("controls")}</h3>
                  <Button variant="outline" onClick={() => setLinkControlDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t("linkControl")}
                  </Button>
                </div>

                {formData.selectedControls.length > 0 ? (
                  <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead className="bg-slate-50">
                        <tr className="h-12">
                          <th className="text-left px-4 text-sm font-medium text-slate-700">{t("controlCode")}</th>
                          <th className="text-left px-4 text-sm font-medium text-slate-700">{t("name")}</th>
                          <th className="text-left px-4 text-sm font-medium text-slate-700">{t("domain")}</th>
                          <th className="text-right px-4 text-sm font-medium text-slate-700">{t("action")}</th>
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
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeFromSelection("selectedControls", controlId)}
                                  className="h-8 w-8 text-slate-400 hover:text-semantic-error"
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
                  <div className="border border-slate-200 rounded-lg">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-3">
                        <Link2 className="h-6 w-6 text-primary-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 mb-1">{t("noControlsLinkedYet")}</p>
                      <p className="text-xs text-slate-400">{t("clickLinkControlToAssociate")}</p>
                    </div>
                  </div>
                )}

                {/* Link Control Dialog */}
                <Dialog open={linkControlDialogOpen} onOpenChange={setLinkControlDialogOpen}>
                  <DialogContent className="max-w-[95vw] sm:max-w-[700px] h-[85vh] flex flex-col p-0 gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader className="flex-shrink-0 px-4 sm:px-6 py-5 border-b border-slate-100">
                      <DialogTitle className="text-lg font-semibold text-slate-800">{t("linkControls")}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 py-4">
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder={t("searchControls")}
                          value={controlSearch}
                          onChange={(e) => setControlSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
                        <table className="w-full min-w-[450px]">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="h-12">
                              <th className="w-10 px-2 sm:px-3"></th>
                              <th className="text-left px-2 sm:px-3 text-sm font-medium text-slate-700">{t("controlCode")}</th>
                              <th className="text-left px-2 sm:px-3 text-sm font-medium text-slate-700">{t("name")}</th>
                              <th className="text-left px-2 sm:px-3 text-sm font-medium text-slate-700">{t("domain")}</th>
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
                        {formData.selectedControls.length} {t("controlsSelected")}
                      </span>
                      <Button onClick={() => setLinkControlDialogOpen(false)}>
                        {t("done")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>

          {/* Create Cause Dialog */}
          <Dialog open={createCauseDialogOpen} onOpenChange={setCreateCauseDialogOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>{t("createNewCause") || "Create New Cause"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="causeName">{t("name")} *</Label>
                  <Input
                    id="causeName"
                    value={newCauseName}
                    onChange={(e) => setNewCauseName(e.target.value)}
                    placeholder={t("enterCauseName") || "Enter cause name"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="causeDescription">{t("description")}</Label>
                  <Textarea
                    id="causeDescription"
                    value={newCauseDescription}
                    onChange={(e) => setNewCauseDescription(e.target.value)}
                    placeholder={t("enterCauseDescription") || "Enter cause description (optional)"}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateCauseDialogOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button onClick={handleCreateCause} disabled={creatingCause || !newCauseName.trim()}>
                  {creatingCause ? t("creating") || "Creating..." : t("create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
            <span className="text-xs font-medium text-slate-400 sm:me-auto text-center sm:text-left">
              {t("Step")} {currentStep} {t("of")} {steps.length}
            </span>
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => router.push("/risks/register") : handlePrevious}
            >
              {currentStep > 1 && <ChevronLeft className="h-4 w-4 me-1" />}
              {currentStep === 1 ? t("cancel") : t("previous")}
            </Button>
            {currentStep < steps.length ? (
              <Button onClick={handleNext}>
                {t("next")}
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? t("saving") : t("saveRisk")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
