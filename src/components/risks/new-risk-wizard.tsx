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
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const isEditMode = !!editData;
  const [currentStep, setCurrentStep] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedRiskId, setGeneratedRiskId] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    riskSources: "",
    categoryId: "",
    typeId: "",
    departmentId: "",
    ownerId: "",
    selectedThreats: [] as string[],
    selectedVulnerabilities: [] as string[],
    selectedCauses: [] as string[],
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchRiskTypes();
      fetchThreats();
      fetchVulnerabilities();
      fetchCauses();

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
          selectedThreats: editData.threats?.map(t => t.threat.id) || [],
          selectedVulnerabilities: editData.vulnerabilities?.map(v => v.vulnerability.id) || [],
          selectedCauses: editData.causes?.map(c => c.cause.id) || [],
        });
      } else {
        generateRiskId();
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

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
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

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
          threats: formData.selectedThreats,
          vulnerabilities: formData.selectedVulnerabilities,
          causes: formData.selectedCauses,
          actor: "System",
        }),
      });

      if (response.ok) {
        resetForm();
        onSuccess();
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} risk:`, error);
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
      selectedThreats: [],
      selectedVulnerabilities: [],
      selectedCauses: [],
    });
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? `Edit Risk - ${editData?.riskId}` : "New Risk"}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="mb-6">
          <nav aria-label="Progress">
            <ol className="flex items-center">
              {steps.map((step, index) => (
                <li
                  key={step.id}
                  className={cn(
                    "relative flex-1",
                    index !== steps.length - 1 && "pr-8"
                  )}
                >
                  <div className="flex items-center">
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                        currentStep >= step.id
                          ? "border-grc-primary bg-grc-primary text-white"
                          : "border-gray-300 bg-white text-gray-500"
                      )}
                    >
                      <span className="text-sm">{step.id}</span>
                    </button>
                    <button
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        "ml-2 text-sm font-medium",
                        currentStep >= step.id
                          ? "text-grc-primary"
                          : "text-gray-500"
                      )}
                    >
                      {step.name}
                    </button>
                    {index !== steps.length - 1 && (
                      <div
                        className={cn(
                          "ml-4 h-0.5 flex-1",
                          currentStep > step.id ? "bg-grc-primary" : "bg-gray-300"
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
        <div className="min-h-[400px]">
          {/* Step 1: Risk Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">{isEditMode ? "Edit Risk" : "New Risk"}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="riskId">Risk ID</Label>
                  <Input
                    id="riskId"
                    value={generatedRiskId}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Risk Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Enter Risk Name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Risk Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Enter Description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={formData.departmentId}
                    onValueChange={(value) => handleInputChange("departmentId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
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
                  <Label htmlFor="owner">Risk Owner</Label>
                  <Select
                    value={formData.ownerId}
                    onValueChange={(value) => handleInputChange("ownerId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="riskSources">Risk Sources</Label>
                  <Input
                    id="riskSources"
                    value={formData.riskSources}
                    onChange={(e) => handleInputChange("riskSources", e.target.value)}
                    placeholder="Enter risk sources"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Risk Category</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => handleInputChange("categoryId", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="riskType">Risk Type</Label>
                  <Select
                    value={formData.typeId}
                    onValueChange={(value) => handleInputChange("typeId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Risk Type" />
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
                <div>
                  <Label>Impacted Asset Groups</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Potential Threats</Label>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(value) => addToSelection("selectedThreats", value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select threats" />
                      </SelectTrigger>
                      <SelectContent>
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
                </div>
                <div>
                  <Label>Associated Vulnerabilities</Label>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={(value) =>
                        addToSelection("selectedVulnerabilities", value)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select vulnerabilities" />
                      </SelectTrigger>
                      <SelectContent>
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
                </div>
              </div>

              <div>
                <Label>Cause</Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => addToSelection("selectedCauses", value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select cause" />
                    </SelectTrigger>
                    <SelectContent>
                      {causes.map((cause) => (
                        <SelectItem key={cause.id} value={cause.id}>
                          {cause.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon">
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Controls</h3>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Link Control
                </Button>
              </div>

              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <p>No controls linked yet.</p>
                <p className="text-sm mt-2">
                  Click &quot;Link Control&quot; to associate controls with this risk.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? handleClose : handlePrevious}
          >
            {currentStep === 1 ? "Cancel" : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </>
            )}
          </Button>
          <div className="flex gap-2">
            {currentStep < steps.length ? (
              <Button onClick={handleNext} disabled={!validateStep()}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Saving..." : (isEditMode ? "Update" : "Save")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
