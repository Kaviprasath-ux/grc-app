"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check } from "lucide-react";
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

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

const processTypes = ["Primary", "Management", "Supporting"];
const processFrequencies = ["Daily", "Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually", "As needed"];
const natureOfImplementations = ["Manual", "Automated", "Manual + Automated"];
const operationalComplexities = ["Low", "Medium", "High"];
const locations = ["Head Office", "Branch Office", "Remote", "Data Center"];

const steps = [
  { step: 1, label: "Info", description: "Basic process information" },
  { step: 2, label: "Process Flow", description: "Process characteristics" },
  { step: 3, label: "Process RACI", description: "Roles and responsibilities" },
];

export default function AddProcessPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);

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
    location: "",
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
        const [deptRes, userRes] = await Promise.all([
          fetch("/api/departments"),
          fetch("/api/users"),
        ]);
        if (deptRes.ok) setDepartments(await deptRes.json());
        if (userRes.ok) setUsers(await userRes.json());
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.processCode.trim() || !formData.name.trim()) {
      toast({ title: "Error", description: "Process ID and Name are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          departmentId: formData.departmentId || null,
          ownerId: formData.ownerId || null,
        }),
      });

      if (res.ok) {
        toast({ title: "Success", description: "Process created successfully" });
        router.push("/organization/process");
      } else {
        const error = await res.json();
        toast({ title: "Error", description: error.error || "Failed to create process", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error creating process:", error);
      toast({ title: "Error", description: "Failed to create process", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Process</h1>
          <p className="text-muted-foreground text-sm">Complete the form to create a new process</p>
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
                      ? "bg-green-600 border-green-600 text-white"
                      : currentStep === item.step
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-500"
                  }`}
                >
                  {currentStep > item.step ? <Check className="h-5 w-5" /> : item.step}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${currentStep >= item.step ? "text-blue-600" : "text-gray-500"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground hidden md:block">{item.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${currentStep > item.step ? "bg-green-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Info */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="processCode">Process ID *</Label>
                <Input
                  id="processCode"
                  value={formData.processCode}
                  onChange={(e) => setFormData({ ...formData, processCode: e.target.value })}
                  placeholder="e.g., PRO001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Process Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter process name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
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
              <div className="space-y-2">
                <Label>Process Owner</Label>
                <Select
                  value={formData.ownerId}
                  onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
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
              <div className="space-y-2">
                <Label>Process Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {processFrequencies.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {freq}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nature of Implementation</Label>
                <Select
                  value={formData.natureOfImplementation}
                  onValueChange={(value) => setFormData({ ...formData, natureOfImplementation: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Nature" />
                  </SelectTrigger>
                  <SelectContent>
                    {natureOfImplementations.map((nature) => (
                      <SelectItem key={nature} value={nature}>
                        {nature}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Process Type</Label>
              <Select
                value={formData.processType}
                onValueChange={(value) => setFormData({ ...formData, processType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {processTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 2: Process Flow */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Operational Complexity</Label>
                <Select
                  value={formData.operationalComplexity}
                  onValueChange={(value) => setFormData({ ...formData, operationalComplexity: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Complexity" />
                  </SelectTrigger>
                  <SelectContent>
                    {operationalComplexities.map((comp) => (
                      <SelectItem key={comp} value={comp}>
                        {comp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastAuditDate">Last Audit Date</Label>
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
                <Label htmlFor="assetDependency" className="text-sm font-normal">Asset Dependency</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="externalDependency"
                  checked={formData.externalDependency}
                  onCheckedChange={(checked) => setFormData({ ...formData, externalDependency: !!checked })}
                />
                <Label htmlFor="externalDependency" className="text-sm font-normal">External Dependency</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kpiMeasurementRequired"
                  checked={formData.kpiMeasurementRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, kpiMeasurementRequired: !!checked })}
                />
                <Label htmlFor="kpiMeasurementRequired" className="text-sm font-normal">KPI Measurement Required</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="piiCapture"
                  checked={formData.piiCapture}
                  onCheckedChange={(checked) => setFormData({ ...formData, piiCapture: !!checked })}
                />
                <Label htmlFor="piiCapture" className="text-sm font-normal">PII Capture</Label>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Process RACI */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Define the RACI matrix for this process - who is Responsible, Accountable, Consulted, and Informed.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsible</Label>
                <Select
                  value={formData.responsible}
                  onValueChange={(value) => setFormData({ ...formData, responsible: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Person who does the work</p>
              </div>
              <div className="space-y-2">
                <Label>Accountable</Label>
                <Select
                  value={formData.accountable}
                  onValueChange={(value) => setFormData({ ...formData, accountable: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Person ultimately answerable</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Consulted</Label>
                <Select
                  value={formData.consulted}
                  onValueChange={(value) => setFormData({ ...formData, consulted: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Person whose input is sought</p>
              </div>
              <div className="space-y-2">
                <Label>Informed</Label>
                <Select
                  value={formData.informed}
                  onValueChange={(value) => setFormData({ ...formData, informed: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Person kept up-to-date on progress</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/organization/process")}>
              Cancel
            </Button>
            {currentStep < 3 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
