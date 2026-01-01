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
import { Slider } from "@/components/ui/slider";
import { RiskRatingBadge } from "./risk-rating-badge";
import { RiskStatusBadge } from "./risk-status-badge";
import {
  Pencil,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
  Target,
  FileText,
  Clock,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Risk {
  id: string;
  riskId: string;
  name: string;
  description: string | null;
  riskSources: string | null;
  category: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  owner: { id: string; fullName: string; email: string } | null;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskRating: string;
  status: string;
  responseStrategy: string | null;
  treatmentPlan?: string | null;
  treatmentDueDate?: string | null;
  treatmentStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  threats?: Array<{ threat: { id: string; name: string } }>;
  vulnerabilities?: Array<{ vulnerability: { id: string; name: string } }>;
  causes?: Array<{ cause: { id: string; name: string } }>;
  activityLogs?: Array<{
    id: string;
    activity: string;
    description: string | null;
    actor: string;
    createdAt: string;
  }>;
  assessments?: Array<{
    id: string;
    assessmentId: string;
    likelihood: number;
    impact: number;
    riskRating: string;
    assessmentDate: string;
    status: string;
  }>;
  responses?: Array<{
    id: string;
    responseId: string;
    responseType: string;
    actionTitle: string;
    status: string;
    dueDate: string | null;
  }>;
}

interface Category {
  id: string;
  name: string;
}

interface RiskType {
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

interface RiskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: Risk | null;
  editMode: boolean;
  onEditModeChange: (editMode: boolean) => void;
  onSuccess: () => void;
  categories: Category[];
  departments: Department[];
}

const likelihoodLabels = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const impactLabels = ["", "Insignificant", "Minor", "Moderate", "Major", "Catastrophic"];

// Carousel sections matching the website
const sections = [
  { id: "overview", label: "Risk Overview", icon: FileText },
  { id: "context", label: "Risk Context", icon: Target },
  { id: "assessment", label: "Risk Assessment", icon: AlertTriangle },
  { id: "controls", label: "Controls", icon: Shield },
  { id: "response", label: "Risk Response", icon: Link2 },
  { id: "activity", label: "Activity Log", icon: Clock },
];

// Risk rating matching website: Catastrophic, Very high, High, Low Risk
function calculateRiskRating(score: number): string {
  if (score >= 20) return "Catastrophic";
  if (score >= 15) return "Very high";
  if (score >= 10) return "High";
  return "Low Risk";
}

export function RiskDetailDialog({
  open,
  onOpenChange,
  risk,
  editMode,
  onEditModeChange,
  onSuccess,
  categories,
  departments,
}: RiskDetailDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [riskTypes, setRiskTypes] = useState<RiskType[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [activityLogs, setActivityLogs] = useState<Risk["activityLogs"]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    riskSources: "",
    categoryId: "",
    typeId: "",
    departmentId: "",
    ownerId: "",
    likelihood: 1,
    impact: 1,
    status: "Open",
    responseStrategy: "",
    treatmentPlan: "",
    treatmentDueDate: "",
  });

  useEffect(() => {
    if (open && risk) {
      fetchUsers();
      fetchRiskTypes();
      fetchActivityLogs(risk.riskId);
      setActiveSection(0);
      setFormData({
        name: risk.name || "",
        description: risk.description || "",
        riskSources: risk.riskSources || "",
        categoryId: risk.category?.id || "",
        typeId: risk.type?.id || "",
        departmentId: risk.department?.id || "",
        ownerId: risk.owner?.id || "",
        likelihood: risk.likelihood || 1,
        impact: risk.impact || 1,
        status: risk.status || "Open",
        responseStrategy: risk.responseStrategy || "",
        treatmentPlan: risk.treatmentPlan || "",
        treatmentDueDate: risk.treatmentDueDate
          ? new Date(risk.treatmentDueDate).toISOString().split("T")[0]
          : "",
      });
    }
  }, [open, risk]);

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

  const fetchActivityLogs = async (riskId: string) => {
    try {
      const response = await fetch(`/api/risks/activity-log?riskId=${riskId}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const riskScore = formData.likelihood * formData.impact;
  const riskRating = calculateRiskRating(riskScore);

  const handleSave = async () => {
    if (!risk) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/risks/${risk.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          riskSources: formData.riskSources || null,
          categoryId: formData.categoryId || null,
          typeId: formData.typeId || null,
          departmentId: formData.departmentId || null,
          ownerId: formData.ownerId || null,
          likelihood: formData.likelihood,
          impact: formData.impact,
          status: formData.status,
          responseStrategy: formData.responseStrategy || null,
          treatmentPlan: formData.treatmentPlan || null,
          treatmentDueDate: formData.treatmentDueDate || null,
        }),
      });

      if (response.ok) {
        onEditModeChange(false);
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to update risk:", error);
    } finally {
      setLoading(false);
    }
  };

  const goToPrevSection = () => {
    setActiveSection((prev) => (prev > 0 ? prev - 1 : sections.length - 1));
  };

  const goToNextSection = () => {
    setActiveSection((prev) => (prev < sections.length - 1 ? prev + 1 : 0));
  };

  if (!risk) return null;

  const CurrentIcon = sections[activeSection].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span className="text-xl font-bold">{risk.riskId}</span>
              <RiskRatingBadge rating={editMode ? riskRating : risk.riskRating} />
              <RiskStatusBadge status={editMode ? formData.status : risk.status} />
            </DialogTitle>
            <div className="flex gap-2">
              {!editMode ? (
                <Button variant="outline" size="sm" onClick={() => onEditModeChange(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => onEditModeChange(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={loading}>
                    <Save className="h-4 w-4 mr-1" />
                    {loading ? "Saving..." : "Save"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Carousel Navigation */}
        <div className="flex items-center justify-between py-3 border-b">
          <Button variant="ghost" size="sm" onClick={goToPrevSection}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(index)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all",
                  activeSection === index
                    ? "bg-primary w-8"
                    : "bg-gray-300 hover:bg-gray-400"
                )}
                title={section.label}
              />
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={goToNextSection}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Section Header */}
        <div className="flex items-center gap-2 py-3 px-1">
          <CurrentIcon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{sections[activeSection].label}</h3>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-1 pb-4">
          {/* Risk Overview Section */}
          {activeSection === 0 && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label htmlFor="name">Risk Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Department</Label>
                      <Select
                        value={formData.departmentId}
                        onValueChange={(value) => handleInputChange("departmentId", value)}
                      >
                        <SelectTrigger>
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
                    <div>
                      <Label>Risk Owner</Label>
                      <Select
                        value={formData.ownerId}
                        onValueChange={(value) => handleInputChange("ownerId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select owner" />
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
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleInputChange("status", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Awaiting Approval">Awaiting Approval</SelectItem>
                        <SelectItem value="Pending Assessment">Pending Assessment</SelectItem>
                        <SelectItem value="Open">Open</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold">{risk.name}</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Risk ID</p>
                      <p className="font-medium">{risk.riskId}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Status</p>
                      <RiskStatusBadge status={risk.status} className="mt-1" />
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Risk Rating</p>
                      <RiskRatingBadge rating={risk.riskRating} className="mt-1" />
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Risk Score</p>
                      <p className="font-bold text-lg">{risk.riskScore}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Department</p>
                      <p className="font-medium">{risk.department?.name || "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Risk Owner</p>
                      <p className="font-medium">{risk.owner?.fullName || "-"}</p>
                      {risk.owner?.email && (
                        <p className="text-xs text-muted-foreground">{risk.owner.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Created</p>
                      <p className="font-medium">
                        {new Date(risk.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Last Updated</p>
                      <p className="font-medium">
                        {new Date(risk.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Risk Context Section */}
          {activeSection === 1 && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label htmlFor="description">Risk Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="riskSources">Risk Sources</Label>
                    <Textarea
                      id="riskSources"
                      value={formData.riskSources}
                      onChange={(e) => handleInputChange("riskSources", e.target.value)}
                      rows={2}
                      placeholder="Enter risk sources..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Risk Category</Label>
                      <Select
                        value={formData.categoryId}
                        onValueChange={(value) => handleInputChange("categoryId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Risk Type</Label>
                      <Select
                        value={formData.typeId}
                        onValueChange={(value) => handleInputChange("typeId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
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
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-2">Description</p>
                    <p className="text-sm">{risk.description || "No description provided"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-2">Risk Sources</p>
                    <p className="text-sm">{risk.riskSources || "No sources specified"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Category</p>
                      <p className="font-medium">{risk.category?.name || "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Risk Type</p>
                      <p className="font-medium">{risk.type?.name || "-"}</p>
                    </div>
                  </div>

                  {/* Threats */}
                  {risk.threats && risk.threats.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase mb-2">Threats</p>
                      <div className="flex flex-wrap gap-2">
                        {risk.threats.map((t) => (
                          <span
                            key={t.threat.id}
                            className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                          >
                            {t.threat.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vulnerabilities */}
                  {risk.vulnerabilities && risk.vulnerabilities.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase mb-2">Vulnerabilities</p>
                      <div className="flex flex-wrap gap-2">
                        {risk.vulnerabilities.map((v) => (
                          <span
                            key={v.vulnerability.id}
                            className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full"
                          >
                            {v.vulnerability.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Causes */}
                  {risk.causes && risk.causes.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase mb-2">Causes</p>
                      <div className="flex flex-wrap gap-2">
                        {risk.causes.map((c) => (
                          <span
                            key={c.cause.id}
                            className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full"
                          >
                            {c.cause.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Risk Assessment Section */}
          {activeSection === 2 && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label>
                      Likelihood: {formData.likelihood} - {likelihoodLabels[formData.likelihood]}
                    </Label>
                    <Slider
                      value={[formData.likelihood]}
                      onValueChange={([value]) => handleInputChange("likelihood", value)}
                      min={1}
                      max={5}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Rare</span>
                      <span>Almost Certain</span>
                    </div>
                  </div>
                  <div>
                    <Label>
                      Impact: {formData.impact} - {impactLabels[formData.impact]}
                    </Label>
                    <Slider
                      value={[formData.impact]}
                      onValueChange={([value]) => handleInputChange("impact", value)}
                      min={1}
                      max={5}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Insignificant</span>
                      <span>Catastrophic</span>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Risk Score:</span>
                      <span className="text-2xl font-bold">{riskScore}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-medium">Risk Rating:</span>
                      <RiskRatingBadge rating={riskRating} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Risk Matrix Visual */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground uppercase">Likelihood</p>
                      <p className="text-3xl font-bold text-blue-600">{risk.likelihood}</p>
                      <p className="text-sm text-blue-600">{likelihoodLabels[risk.likelihood]}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground uppercase">Impact</p>
                      <p className="text-3xl font-bold text-purple-600">{risk.impact}</p>
                      <p className="text-sm text-purple-600">{impactLabels[risk.impact]}</p>
                    </div>
                    <div className="p-4 bg-gray-100 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground uppercase">Risk Score</p>
                      <p className="text-3xl font-bold">{risk.riskScore}</p>
                      <RiskRatingBadge rating={risk.riskRating} className="mt-1" />
                    </div>
                  </div>

                  {/* Risk Matrix Grid */}
                  <div className="mt-6">
                    <p className="text-sm font-medium mb-3">Risk Matrix</p>
                    <div className="grid grid-cols-6 gap-1 text-xs">
                      <div className="p-2"></div>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-2 text-center font-medium">
                          {i}
                        </div>
                      ))}
                      {[5, 4, 3, 2, 1].map((likelihood) => (
                        <>
                          <div key={`l-${likelihood}`} className="p-2 text-center font-medium">
                            {likelihood}
                          </div>
                          {[1, 2, 3, 4, 5].map((impact) => {
                            const score = likelihood * impact;
                            const isCurrentCell =
                              likelihood === risk.likelihood && impact === risk.impact;
                            let bgColor = "bg-green-200";
                            if (score >= 20) bgColor = "bg-red-400";
                            else if (score >= 15) bgColor = "bg-orange-400";
                            else if (score >= 10) bgColor = "bg-yellow-300";
                            else if (score >= 5) bgColor = "bg-green-300";

                            return (
                              <div
                                key={`${likelihood}-${impact}`}
                                className={cn(
                                  "p-2 text-center rounded",
                                  bgColor,
                                  isCurrentCell && "ring-2 ring-black ring-offset-1 font-bold"
                                )}
                              >
                                {score}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>← Likelihood</span>
                      <span>Impact →</span>
                    </div>
                  </div>

                  {/* Assessment History */}
                  {risk.assessments && risk.assessments.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium mb-2">Assessment History</h4>
                      <div className="space-y-2">
                        {risk.assessments.map((assessment) => (
                          <div
                            key={assessment.id}
                            className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                          >
                            <span className="text-sm font-medium">{assessment.assessmentId}</span>
                            <span className="text-sm text-muted-foreground">
                              {new Date(assessment.assessmentDate).toLocaleDateString()}
                            </span>
                            <RiskRatingBadge rating={assessment.riskRating} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Controls Section */}
          {activeSection === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Controls linked to this risk
                </p>
                <Button variant="outline" size="sm">
                  <Link2 className="h-4 w-4 mr-1" />
                  Link Control
                </Button>
              </div>

              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No controls linked to this risk yet</p>
                <p className="text-sm">Click &quot;Link Control&quot; to associate controls with this risk</p>
              </div>
            </div>
          )}

          {/* Risk Response Section */}
          {activeSection === 4 && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label>Response Strategy</Label>
                    <Select
                      value={formData.responseStrategy}
                      onValueChange={(value) => handleInputChange("responseStrategy", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Treat">Treat</SelectItem>
                        <SelectItem value="Transfer">Transfer</SelectItem>
                        <SelectItem value="Avoid">Avoid</SelectItem>
                        <SelectItem value="Accept">Accept</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Treatment Plan</Label>
                    <Textarea
                      value={formData.treatmentPlan}
                      onChange={(e) => handleInputChange("treatmentPlan", e.target.value)}
                      rows={4}
                      placeholder="Describe the treatment plan..."
                    />
                  </div>
                  <div>
                    <Label>Treatment Due Date</Label>
                    <Input
                      type="date"
                      value={formData.treatmentDueDate}
                      onChange={(e) => handleInputChange("treatmentDueDate", e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Response Strategy</p>
                      <p className="font-medium text-lg">
                        {risk.responseStrategy || "Not defined"}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Treatment Due Date</p>
                      <p className="font-medium text-lg">
                        {risk.treatmentDueDate
                          ? new Date(risk.treatmentDueDate).toLocaleDateString()
                          : "Not set"}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-2">Treatment Plan</p>
                    <p className="text-sm">
                      {risk.treatmentPlan || "No treatment plan defined"}
                    </p>
                  </div>
                  {risk.treatmentStatus && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-muted-foreground uppercase">Treatment Status</p>
                      <p className="font-medium">{risk.treatmentStatus}</p>
                    </div>
                  )}

                  {/* Response Actions */}
                  {risk.responses && risk.responses.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium mb-2">Response Actions</h4>
                      <div className="space-y-2">
                        {risk.responses.map((response) => (
                          <div
                            key={response.id}
                            className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <span className="font-medium">{response.actionTitle}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({response.responseType})
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-xs px-2 py-1 rounded-full",
                                response.status === "Completed"
                                  ? "bg-green-100 text-green-800"
                                  : response.status === "In Progress"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              )}
                            >
                              {response.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activity Log Section */}
          {activeSection === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Activity history for this risk
              </p>

              {activityLogs && activityLogs.length > 0 ? (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium">{log.activity}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              by {log.actor}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {log.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No activity logs yet</p>
                  <p className="text-sm mt-1">
                    Created on {new Date(risk.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with section indicators */}
        <div className="border-t pt-3 flex justify-center">
          <p className="text-sm text-muted-foreground">
            {activeSection + 1} of {sections.length}: {sections[activeSection].label}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
