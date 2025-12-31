"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { TimelineSteps } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { Checkbox } from "@/components/ui/checkbox";

// Interfaces
interface RiskCategory {
  id: string;
  name: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
}

interface Threat {
  id: string;
  name: string;
  category: { id: string; name: string } | null;
}

interface ThreatCategory {
  id: string;
  name: string;
}

interface Vulnerability {
  id: string;
  name: string;
  category: { id: string; name: string } | null;
}

interface VulnerabilityCategory {
  id: string;
  name: string;
}

interface Cause {
  id: string;
  name: string;
}

interface AssetGroup {
  id: string;
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
}

const STEPS = [
  { id: 1, name: "Risk Details" },
  { id: 2, name: "Risk Mapping" },
];

export default function NewRiskPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Master data
  const [riskCategories, setRiskCategories] = useState<RiskCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [threatCategories, setThreatCategories] = useState<ThreatCategory[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [vulnerabilityCategories, setVulnerabilityCategories] = useState<VulnerabilityCategory[]>([]);
  const [causes, setCauses] = useState<Cause[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [nextRiskId, setNextRiskId] = useState("RID0001");

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    departmentId: "",
    ownerId: "",
    riskSources: "",
    riskType: "Asset Risk",
    causeId: "",
    categoryId: "",
    threatIds: [] as string[],
    vulnerabilityIds: [] as string[],
    assetGroupIds: [] as string[],
    relatedProcessId: "",
    controlIds: [] as string[],
  });

  // Add dialogs
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddThreat, setShowAddThreat] = useState(false);
  const [showAddVulnerability, setShowAddVulnerability] = useState(false);
  const [showAddCause, setShowAddCause] = useState(false);

  // New item forms
  const [newCategory, setNewCategory] = useState({ name: "", status: "Active" });
  const [newThreat, setNewThreat] = useState({ name: "", description: "", categoryId: "" });
  const [newVulnerability, setNewVulnerability] = useState({ name: "", description: "", categoryId: "" });
  const [newCause, setNewCause] = useState({ name: "" });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [
          risksRes, categoriesRes, deptsRes, usersRes, threatsRes, threatCatsRes,
          vulnsRes, vulnCatsRes, groupsRes, processesRes, controlsRes
        ] = await Promise.all([
          fetch("/api/risks"),
          fetch("/api/risk-categories"),
          fetch("/api/departments"),
          fetch("/api/users"),
          fetch("/api/threats"),
          fetch("/api/threat-categories"),
          fetch("/api/vulnerabilities"),
          fetch("/api/vulnerability-categories"),
          fetch("/api/asset-groups"),
          fetch("/api/processes"),
          fetch("/api/controls"),
        ]);

        const risks = await risksRes.json();
        setRiskCategories(await categoriesRes.json());
        setDepartments(await deptsRes.json());
        setUsers(await usersRes.json());
        setThreats(await threatsRes.json());
        setThreatCategories(await threatCatsRes.json().catch(() => []));
        setVulnerabilities(await vulnsRes.json());
        setVulnerabilityCategories(await vulnCatsRes.json().catch(() => []));
        setAssetGroups(await groupsRes.json());
        setProcesses(await processesRes.json());

        const controlsData = await controlsRes.json();
        setControls(Array.isArray(controlsData) ? controlsData : []);

        // Generate next risk ID
        if (risks.length > 0) {
          const lastRisk = risks.reduce((prev: { riskId: string }, curr: { riskId: string }) => {
            const prevNum = parseInt(prev.riskId.replace("RID", "")) || 0;
            const currNum = parseInt(curr.riskId.replace("RID", "")) || 0;
            return currNum > prevNum ? curr : prev;
          });
          const nextNum = parseInt(lastRisk.riskId.replace("RID", "")) + 1;
          setNextRiskId(`RID${nextNum.toString().padStart(4, "0")}`);
        }

        // Fetch causes (may not exist yet)
        try {
          const causesRes = await fetch("/api/causes");
          if (causesRes.ok) {
            setCauses(await causesRes.json());
          }
        } catch {
          setCauses([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Please enter the Risk Name";
    if (!form.categoryId) newErrors.categoryId = "Please select a Risk Category";
    if (!form.riskType) newErrors.riskType = "Please select a Risk Type";
    if (form.threatIds.length === 0) newErrors.threatIds = "Please select at least one Threat";
    if (form.vulnerabilityIds.length === 0) newErrors.vulnerabilityIds = "Please select at least one Vulnerability";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) {
        setCompletedSteps([...completedSteps, 1]);
        setCurrentStep(2);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          departmentId: form.departmentId || undefined,
          ownerId: form.ownerId || undefined,
          riskSources: form.riskSources,
          riskType: form.riskType,
          causeId: form.causeId || undefined,
          categoryIds: form.categoryId ? [form.categoryId] : [],
          threatIds: form.threatIds,
          vulnerabilityIds: form.vulnerabilityIds,
          assetGroupIds: form.assetGroupIds,
          relatedProcessId: form.relatedProcessId || undefined,
          controlIds: form.controlIds,
        }),
      });

      if (res.ok) {
        router.push("/risk-management/register");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create risk");
      }
    } catch (error) {
      console.error("Error creating risk:", error);
      alert("Failed to create risk");
    }
    setSubmitting(false);
  };

  // Add handlers for master data
  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;
    try {
      const res = await fetch("/api/risk-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCategory),
      });
      if (res.ok) {
        const created = await res.json();
        setRiskCategories(prev => [...prev, created]);
        setForm(prev => ({ ...prev, categoryId: created.id }));
        setNewCategory({ name: "", status: "Active" });
        setShowAddCategory(false);
      }
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleAddThreat = async () => {
    if (!newThreat.name.trim()) return;
    try {
      const res = await fetch("/api/threats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newThreat),
      });
      if (res.ok) {
        const created = await res.json();
        setThreats(prev => [...prev, created]);
        setForm(prev => ({ ...prev, threatIds: [...prev.threatIds, created.id] }));
        setNewThreat({ name: "", description: "", categoryId: "" });
        setShowAddThreat(false);
      }
    } catch (error) {
      console.error("Error adding threat:", error);
    }
  };

  const handleAddVulnerability = async () => {
    if (!newVulnerability.name.trim()) return;
    try {
      const res = await fetch("/api/vulnerabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVulnerability),
      });
      if (res.ok) {
        const created = await res.json();
        setVulnerabilities(prev => [...prev, created]);
        setForm(prev => ({ ...prev, vulnerabilityIds: [...prev.vulnerabilityIds, created.id] }));
        setNewVulnerability({ name: "", description: "", categoryId: "" });
        setShowAddVulnerability(false);
      }
    } catch (error) {
      console.error("Error adding vulnerability:", error);
    }
  };

  const handleAddCause = async () => {
    if (!newCause.name.trim()) return;
    try {
      const res = await fetch("/api/causes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCause),
      });
      if (res.ok) {
        const created = await res.json();
        setCauses(prev => [...prev, created]);
        setForm(prev => ({ ...prev, causeId: created.id }));
        setNewCause({ name: "" });
        setShowAddCause(false);
      }
    } catch (error) {
      console.error("Error adding cause:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/risk-management/register">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-sm text-muted-foreground">Risk Management &gt; Risk Register</p>
          <h1 className="text-2xl font-bold">New Risk</h1>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="pt-6">
          <TimelineSteps
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={setCurrentStep}
            allowNavigation={true}
          />
        </CardContent>
      </Card>

      {/* Form Content */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-6">New Risk</h2>

          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Risk ID and Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Risk ID</Label>
                  <Input value={nextRiskId} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Risk Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter Risk Name"
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Risk Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter Description"
                />
              </div>

              {/* Department and Owner */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={form.departmentId}
                    onValueChange={(v) => setForm(prev => ({ ...prev, departmentId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Risk Owner</Label>
                  <Select
                    value={form.ownerId}
                    onValueChange={(v) => setForm(prev => ({ ...prev, ownerId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Risk Sources and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Risk Sources</Label>
                  <Input
                    value={form.riskSources}
                    onChange={(e) => setForm(prev => ({ ...prev, riskSources: e.target.value }))}
                    placeholder="Enter risk sources"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Risk Category *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.categoryId}
                      onValueChange={(v) => setForm(prev => ({ ...prev, categoryId: v }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Risk Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {riskCategories.filter(c => c.status === "Active").map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowAddCategory(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId}</p>}
                </div>
              </div>

              {/* Risk Type */}
              <div className="space-y-2">
                <Label>Risk Type *</Label>
                <Select
                  value={form.riskType}
                  onValueChange={(v) => setForm(prev => ({ ...prev, riskType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Risk Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asset Risk">Asset Risk</SelectItem>
                    <SelectItem value="Process Risk">Process Risk</SelectItem>
                  </SelectContent>
                </Select>
                {errors.riskType && <p className="text-sm text-destructive">{errors.riskType}</p>}
              </div>

              {/* Threats */}
              <div className="space-y-2">
                <Label>Potential Threats *</Label>
                <MultiSelect
                  options={threats.map(t => ({ value: t.id, label: t.name }))}
                  selected={form.threatIds}
                  onChange={(ids) => setForm(prev => ({ ...prev, threatIds: ids }))}
                  placeholder="Select Potential Threats"
                  onAddNew={() => setShowAddThreat(true)}
                />
                {errors.threatIds && <p className="text-sm text-destructive">{errors.threatIds}</p>}
              </div>

              {/* Vulnerabilities */}
              <div className="space-y-2">
                <Label>Associated Vulnerabilities *</Label>
                <MultiSelect
                  options={vulnerabilities.map(v => ({ value: v.id, label: v.name }))}
                  selected={form.vulnerabilityIds}
                  onChange={(ids) => setForm(prev => ({ ...prev, vulnerabilityIds: ids }))}
                  placeholder="Select Vulnerabilities"
                  onAddNew={() => setShowAddVulnerability(true)}
                />
                {errors.vulnerabilityIds && <p className="text-sm text-destructive">{errors.vulnerabilityIds}</p>}
              </div>

              {/* Cause */}
              <div className="space-y-2">
                <Label>Cause</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.causeId}
                    onValueChange={(v) => setForm(prev => ({ ...prev, causeId: v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select Cause" />
                    </SelectTrigger>
                    <SelectContent>
                      {causes.map(cause => (
                        <SelectItem key={cause.id} value={cause.id}>{cause.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowAddCause(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Asset Groups (for Asset Risk) */}
              {form.riskType === "Asset Risk" && (
                <div className="space-y-2">
                  <Label>Impacted Asset Groups</Label>
                  <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                    {assetGroups.length > 0 ? assetGroups.map(group => (
                      <div key={group.id} className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={form.assetGroupIds.includes(group.id)}
                          onCheckedChange={(checked) => {
                            setForm(prev => ({
                              ...prev,
                              assetGroupIds: checked
                                ? [...prev.assetGroupIds, group.id]
                                : prev.assetGroupIds.filter(id => id !== group.id)
                            }));
                          }}
                        />
                        <label htmlFor={`group-${group.id}`} className="text-sm cursor-pointer">{group.name}</label>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No asset groups available</p>
                    )}
                  </div>
                </div>
              )}

              {/* Related Process (for Process Risk) */}
              {form.riskType === "Process Risk" && (
                <div className="space-y-2">
                  <Label>Related Process</Label>
                  <Select
                    value={form.relatedProcessId}
                    onValueChange={(v) => setForm(prev => ({ ...prev, relatedProcessId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Process" />
                    </SelectTrigger>
                    <SelectContent>
                      {processes.map(proc => (
                        <SelectItem key={proc.id} value={proc.id}>
                          {proc.processCode} - {proc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Controls */}
              <div className="space-y-2">
                <Label>Link Existing Controls</Label>
                <p className="text-sm text-muted-foreground mb-2">Select controls to link to this risk</p>
                <div className="border rounded-md p-3 max-h-60 overflow-y-auto">
                  {controls.length > 0 ? controls.map(control => (
                    <div key={control.id} className="flex items-center space-x-2 mb-2">
                      <Checkbox
                        id={`control-${control.id}`}
                        checked={form.controlIds.includes(control.id)}
                        onCheckedChange={(checked) => {
                          setForm(prev => ({
                            ...prev,
                            controlIds: checked
                              ? [...prev.controlIds, control.id]
                              : prev.controlIds.filter(id => id !== control.id)
                          }));
                        }}
                      />
                      <label htmlFor={`control-${control.id}`} className="text-sm cursor-pointer">
                        {control.controlCode} - {control.name}
                      </label>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No controls available</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
            <Button variant="outline" onClick={() => router.push("/risk-management/register")}>
              Cancel
            </Button>
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Creating..." : "Save"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Risk Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter category name"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="categoryStatus"
                    checked={newCategory.status === "Active"}
                    onChange={() => setNewCategory(prev => ({ ...prev, status: "Active" }))}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="categoryStatus"
                    checked={newCategory.status === "Inactive"}
                    onChange={() => setNewCategory(prev => ({ ...prev, status: "Inactive" }))}
                  />
                  Inactive
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategory(false)}>Cancel</Button>
            <Button onClick={handleAddCategory}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Threat Dialog */}
      <Dialog open={showAddThreat} onOpenChange={setShowAddThreat}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Threat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Threat Category</Label>
              <Select
                value={newThreat.categoryId}
                onValueChange={(v) => setNewThreat(prev => ({ ...prev, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {threatCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Threat</Label>
              <Input
                value={newThreat.name}
                onChange={(e) => setNewThreat(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter threat name"
              />
            </div>
            <div className="space-y-2">
              <Label>Threat Description</Label>
              <Textarea
                value={newThreat.description}
                onChange={(e) => setNewThreat(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddThreat(false)}>Cancel</Button>
            <Button onClick={handleAddThreat}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vulnerability Dialog */}
      <Dialog open={showAddVulnerability} onOpenChange={setShowAddVulnerability}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vulnerability</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vulnerability Category</Label>
              <Select
                value={newVulnerability.categoryId}
                onValueChange={(v) => setNewVulnerability(prev => ({ ...prev, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {vulnerabilityCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vulnerability</Label>
              <Input
                value={newVulnerability.name}
                onChange={(e) => setNewVulnerability(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter vulnerability name"
              />
            </div>
            <div className="space-y-2">
              <Label>Vulnerability Description</Label>
              <Textarea
                value={newVulnerability.description}
                onChange={(e) => setNewVulnerability(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVulnerability(false)}>Cancel</Button>
            <Button onClick={handleAddVulnerability}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cause Dialog */}
      <Dialog open={showAddCause} onOpenChange={setShowAddCause}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cause</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cause</Label>
              <Input
                value={newCause.name}
                onChange={(e) => setNewCause(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter cause"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCause(false)}>Cancel</Button>
            <Button onClick={handleAddCause}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
