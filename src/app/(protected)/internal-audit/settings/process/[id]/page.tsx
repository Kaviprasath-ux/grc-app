"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ArrowLeft, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  userRoles?: { role: { name: string } }[];
}

interface Process {
  id: string;
  processCode: string;
  name: string;
  description: string | null;
  processType: string | null;
  status: string | null;
  departmentId: string | null;
  ownerId: string | null;
  processFrequency: string | null;
  natureOfImplementation: string | null;
  riskRating: string | null;
  assetDependency: boolean;
  assetId: string | null;
  externalDependency: boolean;
  externalParty: string | null;
  location: string | null;
  kpiMeasurementRequired: boolean;
  piiCapture: boolean;
  recurrence: string | null;
  reviewDate: string | null;
  operationalComplexity: string | null;
  lastAuditDate: string | null;
  responsibleId: string | null;
  accountableId: string | null;
  consultedId: string | null;
  informedId: string | null;
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

export default function EditProcessPage() {
  const router = useRouter();
  const params = useParams();
  const processId = params.id as string;
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processFrequencies, setProcessFrequencies] = useState<ProcessFrequency[]>([]);
  const [natureOfImplementations, setNatureOfImplementations] = useState<NatureOfImplementation[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [processCode, setProcessCode] = useState("");

  // Dialog states
  const [showFrequencyDialog, setShowFrequencyDialog] = useState(false);
  const [showNatureDialog, setShowNatureDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [newFrequency, setNewFrequency] = useState("");
  const [newNature, setNewNature] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [dialogSaving, setDialogSaving] = useState(false);

  const TOTAL_STEPS = 3;

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
  }, [processId]);

  const fetchData = async () => {
    try {
      const [processRes, departmentsRes, usersRes, frequenciesRes, natureRes, locationsRes, assetsRes, stakeholdersRes] = await Promise.all([
        fetch(`/api/processes/${processId}`),
        fetch("/api/departments"),
        fetch("/api/users"),
        fetch("/api/internal-audit/process-frequency"),
        fetch("/api/internal-audit/nature-of-implementation"),
        fetch("/api/internal-audit/locations"),
        fetch("/api/assets"),
        fetch("/api/stakeholders"),
      ]);

      if (processRes.ok) {
        const process: Process = await processRes.json();
        setProcessCode(process.processCode);
        setFormData({
          name: process.name || "",
          description: process.description || "",
          processType: process.processType || "Primary",
          status: process.status || "Active",
          departmentId: process.departmentId || "",
          ownerId: process.ownerId || "",
          location: process.location || "",
          responsibleId: process.responsibleId || "",
          accountableId: process.accountableId || "",
          consultedId: process.consultedId || "",
          informedId: process.informedId || "",
          processFrequency: process.processFrequency || "",
          natureOfImplementation: process.natureOfImplementation || "",
          assetDependency: process.assetDependency || false,
          assetId: process.assetId || "",
          externalDependency: process.externalDependency || false,
          externalParty: process.externalParty || "",
          kpiMeasurementRequired: process.kpiMeasurementRequired || false,
          piiCapture: process.piiCapture || false,
          recurrence: process.recurrence || "",
          reviewDate: process.reviewDate
            ? new Date(process.reviewDate).toISOString().split("T")[0]
            : "",
          operationalComplexity: process.operationalComplexity || "",
          lastAuditDate: process.lastAuditDate
            ? new Date(process.lastAuditDate).toISOString().split("T")[0]
            : "",
        });
      } else {
        toast({ title: "Error", description: "Process not found", variant: "destructive" });
        router.push("/internal-audit/settings/process");
        return;
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

  const handleNext = () => {
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
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Please enter a process name", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body = {
        ...formData,
        departmentId: formData.departmentId || null,
        ownerId: formData.ownerId || null,
        lastAuditDate: formData.lastAuditDate || null,
        responsibleId: formData.responsibleId || null,
        accountableId: formData.accountableId || null,
        consultedId: formData.consultedId || null,
        informedId: formData.informedId || null,
      };

      const response = await fetch(`/api/processes/${processId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Process updated successfully!" });
        router.push("/internal-audit/settings/process");
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: `Failed to update process: ${errorData.error || "Unknown error"}`, variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "An error occurred while updating the process", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddFrequency = async () => {
    if (!newFrequency.trim()) {
      toast({ title: "Error", description: "Please enter a frequency name", variant: "destructive" });
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
        toast({ title: "Success", description: "Process frequency added successfully!" });
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.error || "Failed to add process frequency", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to add frequency:", error);
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleAddNature = async () => {
    if (!newNature.trim()) {
      toast({ title: "Error", description: "Please enter a nature of implementation", variant: "destructive" });
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
        toast({ title: "Success", description: "Nature of implementation added successfully!" });
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.error || "Failed to add nature of implementation", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to add nature:", error);
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.trim()) {
      toast({ title: "Error", description: "Please enter a location name", variant: "destructive" });
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
        toast({ title: "Success", description: "Location added successfully!" });
      } else {
        const errorData = await response.json();
        toast({ title: "Error", description: errorData.error || "Failed to add location", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to add location:", error);
      toast({ title: "Error", description: "An error occurred", variant: "destructive" });
    } finally {
      setDialogSaving(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Basic Information";
      case 2: return "Add Documents";
      case 3: return "RACI Assignment";
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
    <div className="space-y-6 p-6">
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
          <h1 className="text-2xl font-bold">Edit Process</h1>
          <p className="text-gray-600">Update process details</p>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-card rounded-lg border">
        <div className="p-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  step === currentStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : step < currentStep
                    ? "bg-primary/20 border-primary"
                    : "border-gray-300"
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-24 h-0.5 ${step < currentStep ? "bg-primary" : "bg-gray-300"}`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-xl font-semibold text-center mb-6">{getStepTitle()}</h2>

          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Process ID</Label>
                  <Input value={processCode} disabled className="mt-2 bg-muted" />
                </div>
                <div>
                  <Label htmlFor="name">Process Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter Process Name"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter Description"
                  className="mt-2"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={formData.departmentId}
                    onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
                  >
                    <SelectTrigger className="mt-2">
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
                  <Label>Process Owner</Label>
                  <Select
                    value={formData.ownerId}
                    onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
                  >
                    <SelectTrigger className="mt-2">
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
                  <Label>Process Frequency</Label>
                  <div className="flex gap-2 mt-2">
                    <Select
                      value={formData.processFrequency}
                      onValueChange={(value) => setFormData({ ...formData, processFrequency: value })}
                    >
                      <SelectTrigger className="flex-1">
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
                      title="Add Process Frequency"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Nature of Implementation</Label>
                  <div className="flex gap-2 mt-2">
                    <Select
                      value={formData.natureOfImplementation}
                      onValueChange={(value) => setFormData({ ...formData, natureOfImplementation: value })}
                    >
                      <SelectTrigger className="flex-1">
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
                      title="Add Nature of Implementation"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label>Location</Label>
                <div className="flex gap-2 mt-2">
                  <Select
                    value={formData.location}
                    onValueChange={(value) => setFormData({ ...formData, location: value })}
                  >
                    <SelectTrigger className="flex-1">
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
                    title="Add Location"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="assetDependency"
                      checked={formData.assetDependency}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, assetDependency: checked as boolean, assetId: checked ? formData.assetId : "" })
                      }
                    />
                    <Label htmlFor="assetDependency" className="cursor-pointer">
                      Asset Dependency
                    </Label>
                  </div>
                  {formData.assetDependency && (
                    <div className="ml-6">
                      <Label>Select Asset</Label>
                      <Select
                        value={formData.assetId}
                        onValueChange={(value) => setFormData({ ...formData, assetId: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select Asset" />
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="externalDependency"
                      checked={formData.externalDependency}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, externalDependency: checked as boolean, externalParty: checked ? formData.externalParty : "" })
                      }
                    />
                    <Label htmlFor="externalDependency" className="cursor-pointer">
                      External Dependency
                    </Label>
                  </div>
                  {formData.externalDependency && (
                    <div className="ml-6">
                      <Label>Stakeholder</Label>
                      <Select
                        value={formData.externalParty}
                        onValueChange={(value) => setFormData({ ...formData, externalParty: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select Stakeholder" />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="kpiMeasurementRequired"
                    checked={formData.kpiMeasurementRequired}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, kpiMeasurementRequired: checked as boolean })
                    }
                  />
                  <Label htmlFor="kpiMeasurementRequired" className="cursor-pointer">
                    KPI Measurement Required
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="piiCapture"
                    checked={formData.piiCapture}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, piiCapture: checked as boolean })
                    }
                  />
                  <Label htmlFor="piiCapture" className="cursor-pointer">
                    PII Capture
                  </Label>
                </div>
              </div>

              {/* Conditional fields: Recurrence and Review Date (shown when KPI or PII is checked) */}
              {(formData.kpiMeasurementRequired || formData.piiCapture) && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
                  <div>
                    <Label>Recurrence</Label>
                    <Select
                      value={formData.recurrence}
                      onValueChange={(value) => setFormData({ ...formData, recurrence: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select Recurrence" />
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
                    <Label htmlFor="reviewDate">Review Date</Label>
                    <DatePicker
                      value={formData.reviewDate}
                      onChange={(date) => setFormData({ ...formData, reviewDate: date ? date.toISOString().split('T')[0] : "" })}
                      placeholder="Select date"
                      className="mt-2"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Operational Complexity</Label>
                  <Select
                    value={formData.operationalComplexity}
                    onValueChange={(value) => setFormData({ ...formData, operationalComplexity: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select Complexity" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATIONAL_COMPLEXITIES.map((complexity) => (
                        <SelectItem key={complexity} value={complexity}>
                          {complexity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lastAuditDate">Last Audit Date</Label>
                  <DatePicker
                    value={formData.lastAuditDate}
                    onChange={(date) => setFormData({ ...formData, lastAuditDate: date ? date.toISOString().split('T')[0] : "" })}
                    placeholder="Select date"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add Documents */}
          {currentStep === 2 && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
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
                      Drag and drop files here, or click to browse
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Support for PDF, DOC, DOCX, XLS, XLSX (Max 10MB)
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
                  <p className="text-sm font-medium text-gray-700">Uploaded Files ({uploadedFiles.length}):</p>
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
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-sm text-gray-500 mt-2">
                You can upload multiple documents related to this process
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Responsible</Label>
                        <Select
                          value={formData.responsibleId}
                          onValueChange={(value) => setFormData({ ...formData, responsibleId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select Responsible" />
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
                        <Label>Accountable</Label>
                        <Select
                          value={formData.accountableId}
                          onValueChange={(value) => setFormData({ ...formData, accountableId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select Accountable" />
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Consulted</Label>
                        <Select
                          value={formData.consultedId}
                          onValueChange={(value) => setFormData({ ...formData, consultedId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select Consulted" />
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
                        <Label>Informed</Label>
                        <Select
                          value={formData.informedId}
                          onValueChange={(value) => setFormData({ ...formData, informedId: value })}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select Informed" />
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
          <div className="flex justify-between mt-8 max-w-4xl mx-auto">
            <Button variant="outline" onClick={() => router.push("/internal-audit/settings/process")}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button variant="outline" onClick={handlePrevious}>
                  Previous
                </Button>
              )}
              {currentStep < TOTAL_STEPS && (
                <Button onClick={handleNext} disabled={currentStep === 1 && !formData.name.trim()}>
                  Next
                </Button>
              )}
              {currentStep === TOTAL_STEPS && (
                <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
                  {saving ? "Saving..." : "Update"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Process Frequency Dialog */}
      <Dialog open={showFrequencyDialog} onOpenChange={setShowFrequencyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Process Frequency</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="frequencyName">Name *</Label>
              <Input
                id="frequencyName"
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value)}
                placeholder="e.g., Daily, Weekly, Monthly, Quarterly"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFrequencyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFrequency} disabled={dialogSaving}>
              {dialogSaving ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Nature of Implementation Dialog */}
      <Dialog open={showNatureDialog} onOpenChange={setShowNatureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Nature of Implementation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="nature">Name *</Label>
              <Input
                id="nature"
                value={newNature}
                onChange={(e) => setNewNature(e.target.value)}
                placeholder="e.g., Manual, Automated, Manual + Automated"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNatureDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNature} disabled={dialogSaving}>
              {dialogSaving ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="locationName">Location Name *</Label>
              <Input
                id="locationName"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g., Head Office, Branch A, Remote"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLocation} disabled={dialogSaving}>
              {dialogSaving ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
